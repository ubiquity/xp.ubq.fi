# Deno Deploy CI/CD Troubleshooting Guide

If you see this error in your GitHub Actions workflow:

```
Error: APIError: The authorization token is not valid: You don't have permission to access the project 'xp.ubq.fi'. Please ensure your workflow file references the correct project
```

Follow these steps to resolve it:

---

## 1. Project Existence

- Go to https://dash.deno.com/
- Confirm that a project named **exactly** `xp.ubq.fi` exists in your dashboard.
  - The name must match exactly, including case, dots, and dashes.

---

## 2. Project Ownership

- Check who owns the project (`xp.ubq.fi`):
  - If you are using an **organization token**, the project must be owned by that organization.
  - If you are using a **personal token**, the project must be owned by your user account.

---

## 3. Token Permissions

- Go to https://dash.deno.com/account
- Regenerate a new **Deploy Token** from the account or organization that owns the project.
- Add this token to your GitHub repository as the `DENO_DEPLOY_TOKEN` secret.

---

## 4. Workflow Configuration

- In `.github/workflows/deno-deploy.yml`, ensure:
  - `project: "xp.ubq.fi"`
  - `entrypoint: "deno/artifact-proxy.ts"`

---

## 5. Test with a New Project (if issues persist)

- Create a new project in the Deno Deploy dashboard under the correct owner.
- Use a simple entrypoint (e.g., `deno/main.ts` with `console.log("Hello Deno Deploy")`).
- Update your workflow to deploy to this new project.
- If this works, the issue is with the original project's ownership or permissions.

---

## 6. Contact Deno Support

- If you still see the error, contact Deno Deploy support at [deploy@deno.com](mailto:deploy@deno.com) and include the `x-deno-ray` code from the error message.

---

**Summary:**
This error is always due to a mismatch between the project name, project owner, and the deploy token's permissions. The workflow and CI setup are correct; the fix is in the Deno Deploy dashboard and token management.
