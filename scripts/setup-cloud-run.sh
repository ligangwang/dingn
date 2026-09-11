#!/usr/bin/env bash
# Run once as the project owner in Cloud Shell from the extracted website source.
set -euo pipefail
cd "$(dirname "$0")/.."
project=dingn-193716
region=us-central1
project_number=211238433635
deployer="dingn-github-deploy@$project.iam.gserviceaccount.com"
runtime="dingn-web-runtime@$project.iam.gserviceaccount.com"
image="$region-docker.pkg.dev/$project/dingn-web/website:bootstrap-$(date -u +%Y%m%d%H%M%S)"

gcloud services enable run.googleapis.com artifactregistry.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project "$project" --quiet
for account in dingn-github-deploy dingn-web-runtime; do
  if ! gcloud iam service-accounts describe "$account@$project.iam.gserviceaccount.com" --project "$project" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$account" --project "$project" --display-name "$account" --quiet
  fi
done
if ! gcloud artifacts repositories describe dingn-web --location "$region" --project "$project" >/dev/null 2>&1; then
  gcloud artifacts repositories create dingn-web --repository-format docker --location "$region" --project "$project" --quiet
fi

# Bootstrap the real website as owner, then scope CI's update access to this service.
gcloud auth configure-docker "$region-docker.pkg.dev" --quiet
docker build --tag "$image" .
docker push "$image"
gcloud run deploy dingn-web --image "$image" --project "$project" --region "$region" \
  --service-account "$runtime" --allow-unauthenticated --port 8080 --memory 256Mi --cpu 1 \
  --min-instances 0 --max-instances 2 --timeout 60 --quiet

if ! gcloud iam workload-identity-pools describe dingn-github --location global --project "$project" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create dingn-github --location global --project "$project" --display-name 'dingn GitHub deployments' --quiet
fi
condition="assertion.repository_id == '227018999' && assertion.repository_owner_id == '6968989' && assertion.ref == 'refs/heads/master' && assertion.workflow_ref == 'ligangwang/dingn/.github/workflows/website.yml@refs/heads/master' && (assertion.event_name == 'push' || assertion.event_name == 'workflow_dispatch')"
if gcloud iam workload-identity-pools providers describe github --workload-identity-pool dingn-github --location global --project "$project" >/dev/null 2>&1; then
  provider_command=update-oidc
else
  provider_command=create-oidc
fi
gcloud iam workload-identity-pools providers "$provider_command" github \
  --workload-identity-pool dingn-github --location global --project "$project" \
  --issuer-uri https://token.actions.githubusercontent.com \
  --attribute-mapping 'google.subject=assertion.sub,attribute.repository_id=assertion.repository_id' \
  --attribute-condition "$condition" --quiet
gcloud iam service-accounts add-iam-policy-binding "$deployer" --project "$project" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$project_number/locations/global/workloadIdentityPools/dingn-github/attribute.repository_id/227018999" --quiet
gcloud artifacts repositories add-iam-policy-binding dingn-web --location "$region" --project "$project" \
  --member "serviceAccount:$deployer" --role roles/artifactregistry.writer --quiet
gcloud run services add-iam-policy-binding dingn-web --region "$region" --project "$project" \
  --member "serviceAccount:$deployer" --role roles/run.developer --quiet
gcloud iam service-accounts add-iam-policy-binding "$runtime" --project "$project" \
  --member "serviceAccount:$deployer" --role roles/iam.serviceAccountUser --quiet
gcloud run services describe dingn-web --project "$project" --region "$region" --format='value(status.url)'
