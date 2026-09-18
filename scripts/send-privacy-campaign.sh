#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CAMPAIGN_FILE="${1:-${BACKEND_DIR}/data/email-campaigns/privacy-alert-2026-09-15.json}"
API_URL="${ZECLEANER_API_URL:-http://localhost:3000/api/test-send-email}"
MODE="${2:---dry-run}"

if [[ ! -f "${CAMPAIGN_FILE}" ]]; then
  echo "Fichier de campagne introuvable : ${CAMPAIGN_FILE}" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Ce script nécessite jq." >&2
  exit 1
fi

if [[ "${MODE}" != "--dry-run" && "${MODE}" != "--send" ]]; then
  echo "Usage : $0 [fichier.json] [--dry-run|--send]" >&2
  exit 1
fi

eligible_count="$(jq '[.analysis as $analysis | .recipients[] | select(.status == "pending" and ((.analysis_confirmed // $analysis.confirmed) == true) and (((.verified_findings // $analysis.verified_findings) // []) | length > 0))] | length' "${CAMPAIGN_FILE}")"
skipped_count="$(jq '[.analysis as $analysis | .recipients[] | select(.status == "pending" and (((.analysis_confirmed // $analysis.confirmed) != true) or ((((.verified_findings // $analysis.verified_findings) // []) | length) == 0)))] | length' "${CAMPAIGN_FILE}")"

echo "Campagne : $(jq -r '.campaign_id' "${CAMPAIGN_FILE}")"
echo "Destinataires éligibles : ${eligible_count}"
echo "Destinataires ignorés faute d’analyse confirmée : ${skipped_count}"

if [[ "${MODE}" == "--dry-run" ]]; then
  echo "Simulation terminée. Aucun e-mail envoyé."
  exit 0
fi

if [[ -z "${TEST_WEBHOOK_SECRET:-}" ]]; then
  echo "La variable TEST_WEBHOOK_SECRET est requise en mode --send." >&2
  exit 1
fi

if [[ "${eligible_count}" -eq 0 ]]; then
  echo "Aucun destinataire ne possède de constat vérifié. Envoi annulé."
  exit 0
fi

while IFS= read -r recipient; do
  email="$(jq -r '.email' <<<"${recipient}")"
  payload="$(jq -c '{
    email: .email,
    template: "privacy-alert",
    analysisConfirmed: .analysis_confirmed,
    firstName: (.first_name // null),
    trackerCount: (.tracker_count // null),
    verifiedFindings: .verified_findings
  }' <<<"${recipient}")"

  response_file="$(mktemp)"
  http_code="$(curl --silent --show-error --output "${response_file}" --write-out '%{http_code}' \
    --request POST "${API_URL}" \
    --header 'Content-Type: application/json' \
    --header "X-Test-Secret: ${TEST_WEBHOOK_SECRET}" \
    --data "${payload}" || true)"

  if [[ "${http_code}" == "200" ]] && jq -e '.ok == true' "${response_file}" >/dev/null 2>&1; then
    sent_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    temp_campaign="$(mktemp)"
    jq --arg email "${email}" --arg sent_at "${sent_at}" '
      (.recipients[] | select(.email == $email)) |=
        (.status = "sent" | .sent_at = $sent_at | .error = null) |
      .delivery.sent_count = ([.recipients[] | select(.status == "sent")] | length) |
      .delivery.failed_count = ([.recipients[] | select(.status == "failed")] | length) |
      .delivery.pending_count = ([.recipients[] | select(.status == "pending")] | length)
    ' "${CAMPAIGN_FILE}" > "${temp_campaign}"
    mv "${temp_campaign}" "${CAMPAIGN_FILE}"
    echo "Envoyé : ${email}"
  else
    error_message="$(jq -r '.error // "Erreur inconnue"' "${response_file}" 2>/dev/null || echo "Erreur HTTP ${http_code}")"
    temp_campaign="$(mktemp)"
    jq --arg email "${email}" --arg error "${error_message}" '
      (.recipients[] | select(.email == $email)) |= (.error = $error) |
      .delivery.failed_count = ([.recipients[] | select(.status == "failed")] | length) |
      .delivery.pending_count = ([.recipients[] | select(.status == "pending")] | length)
    ' "${CAMPAIGN_FILE}" > "${temp_campaign}"
    mv "${temp_campaign}" "${CAMPAIGN_FILE}"
    echo "Échec : ${email} — ${error_message}" >&2
  fi
  rm -f "${response_file}"
done < <(jq -c '.analysis as $analysis | .recipients[] | select(.status == "pending" and ((.analysis_confirmed // $analysis.confirmed) == true) and (((.verified_findings // $analysis.verified_findings) // []) | length > 0)) | . + {analysis_confirmed: (.analysis_confirmed // $analysis.confirmed), tracker_count: (.tracker_count // $analysis.tracker_count), verified_findings: (.verified_findings // $analysis.verified_findings)}' "${CAMPAIGN_FILE}")

echo "Campagne terminée."
