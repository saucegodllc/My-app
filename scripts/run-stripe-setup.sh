#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo
echo "ConnectSphere Stripe setup"
echo "Paste your live Stripe secret key into this local terminal only."
echo "It will not be saved to a file or printed back."
echo

read -rsp "Stripe live secret key (sk_live_...): " STRIPE_SECRET_KEY_INPUT
echo

if [[ -z "${STRIPE_SECRET_KEY_INPUT}" || "${STRIPE_SECRET_KEY_INPUT}" != sk_live_* ]]; then
  echo "That does not look like a live Stripe secret key. Expected it to start with sk_live_." >&2
  unset STRIPE_SECRET_KEY_INPUT
  exit 1
fi

STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY_INPUT}" node stripe-setup.js

unset STRIPE_SECRET_KEY_INPUT
echo
echo "Done. Copy only the printed STRIPE_PRICE_MONTHLY and STRIPE_PRICE_YEARLY values into Render."
