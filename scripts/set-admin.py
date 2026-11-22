"""Run in authenticated Cloud Shell: python3 scripts/set-admin.py EMAIL --grant.
Requires Firebase Authentication admin permissions; never runs in the website.
"""
import argparse
import json
import subprocess
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument("email")
action = parser.add_mutually_exclusive_group(required=True)
action.add_argument("--grant", action="store_true")
action.add_argument("--revoke", action="store_true")
args = parser.parse_args()
project = "dingn-193716"
token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()

def call(method, payload):
    request = urllib.request.Request(
        f"https://identitytoolkit.googleapis.com/v1/projects/{project}/accounts:{method}",
        data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request) as response:
        return json.load(response)

users = call("lookup", {"email": [args.email]}).get("users", [])
if len(users) != 1 or users[0].get("email", "").lower() != args.email.lower():
    raise SystemExit("No unique matching Firebase user. Sign in to dingn first.")
user = users[0]
if user.get("disabled") or not user.get("emailVerified"):
    raise SystemExit("The account must be enabled and have a verified email.")
# Old flags and the role each one is, as LEGACY_FLAGS in scripts/roles.mjs.
LEGACY_FLAGS = {"admin": "administrator", "developer": "developer", "tester": "tester"}
claims = json.loads(user.get("customAttributes", "{}"))
# Every role the account holds is kept as it is, including any this script
# doesn't know; old `admin: true`-style flags move into the list. Only
# administrator is added or removed.
roles = claims.pop("roles", None)
roles = [r for r in roles if isinstance(r, str)] if isinstance(roles, list) else []
for flag, role in LEGACY_FLAGS.items():
    if claims.pop(flag, None) is True and role not in roles:
        roles.append(role)
if args.grant and "administrator" not in roles:
    roles.append("administrator")
if not args.grant:
    roles = [r for r in roles if r != "administrator"]
if roles:
    claims["roles"] = roles
call("update", {"localId": user["localId"], "customAttributes": json.dumps(claims)})
verified = call("lookup", {"localId": [user["localId"]]})["users"][0]
assert ("administrator" in json.loads(verified.get("customAttributes", "{}")).get("roles", [])) == args.grant
print("Administrator role", "granted" if args.grant else "removed", "for", args.email)
print("Sign out and back in to refresh the ID token. Existing tokens may remain valid for up to an hour.")
