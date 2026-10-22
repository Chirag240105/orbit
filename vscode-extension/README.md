# ORBIT Personal AI for VS Code

Connect the extension to an ORBIT backend. In ORBIT Projects, authorize the
project folder and note its workspace ID. In VS Code, run **ORBIT: Link
Authorized Workspace** and enter that ID.

Set an ORBIT bearer token with **ORBIT: Set API Token** or when first prompted.
The extension stores the token in VS Code SecretStorage. Hosted code sharing is
off by default; enable it from the command palette, then confirm each code send.
Code is sent to the backend, which applies workspace exclusions and secret
redaction before hosted inference. Redaction is best effort.

Commands: Explain Selection, Explain File, Explain Project, Trace Flow, Link
Workspace, Toggle Hosted Code Sharing, and Set API Token.

Build with npm install, npm run compile, and npm run package. The generated
VSIX is local build output and is not committed.
