# Apps Script automation canary

Temporary Beta-only provider capability probe approved after D159 Owner PASS.

Purpose: prove that GitHub Actions can use the protected `CLASPRC_JSON` environment secret to create a standalone Apps Script project, push repo-managed source, create immutable versions, create/update/list/delete a deployment, and delete the temporary script.

Guards:
- no business data;
- no Firestore / RTDB / WMS / Cloudflare / Drive business-file access;
- web app access is `MYSELF`, never public;
- exact Script ID and deployment ID are never committed or intentionally printed;
- the deployment and script must be cleaned up in the same workflow run;
- Stable is forbidden.
