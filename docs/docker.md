# Docker setup

Docker serves the VModel studio to a browser.
The browser uses the camera on the computer where you open VModel.
The browser runs tracking and renders the model.
Camera images stay in that browser.
The container does not need a camera device or GPU.

Docker Compose is the tool that starts the containers in `compose.yaml`.
Use Docker with Linux containers and Docker Compose v2.
The first build needs internet access for packages, tracking models, and the browser that creates model thumbnails.
After the build, the studio loads its runtime files from the server.

## Start on the same computer

1. Open a terminal in the repository folder.
2. Start the studio:

   ```sh
   docker compose up -d --build
   ```

3. Open `http://localhost:4173` in Chrome or Edge.
4. Select **Start camera**.
5. When the browser requests camera access, select **Allow**.

The browser can remember your permission.
It might not request permission again.
If access fails, check camera permission in the browser and the operating system.
Close other applications that hold the camera.

The default port accepts connections from this computer only.
If port 4173 is in use, set `VMODEL_HTTP_PORT=4180` in a `.env` file.
Then use `http://localhost:4180`.

To stop the studio, run:

```sh
docker compose down
```

## Start on a local network server

Browsers require a secure context for camera access.
A secure context uses trusted HTTPS or a local address such as `localhost`.
An HTTP address such as `http://192.168.1.10:4173` cannot provide camera access.
See the [browser camera requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

Caddy is the HTTPS server in `compose.lan.yaml`.
Caddy creates a local certificate authority (CA) that signs the server certificate.
Each client must trust this CA.
See [Caddy local HTTPS](https://caddyserver.com/docs/automatic-https#local-https).

1. Create `.env` in the repository folder on the server.
2. Set the server name or fixed local IP address:

   ```dotenv
   VMODEL_DOMAIN=192.168.1.10
   ```

3. If you use a server name, configure each client to resolve that name to the server address.
4. Permit inbound TCP ports 80 and 443 from your local network in the server firewall.
5. Start the studio and Caddy:

   ```sh
   docker compose -f compose.yaml -f compose.lan.yaml up -d --build
   ```

6. Copy the public CA certificate from Caddy:

   ```sh
   docker compose -f compose.yaml -f compose.lan.yaml cp https:/data/caddy/pki/authorities/local/root.crt ./vmodel-local-ca.crt
   ```

7. Install `vmodel-local-ca.crt` as a trusted root certificate on each client.
8. Restart the client browser.
9. Open `https://192.168.1.10`, or the server name you set.
10. Select **Start camera**.
11. When the browser requests camera access, select **Allow**.

On Windows, use **Install Certificate**, then **Current User**, then **Trusted Root Certification Authorities**.
Other operating systems and browsers can use different certificate stores.
The browser must show a trusted connection before you start the camera.
Do not use a certificate warning bypass as the setup method.
Copy only `root.crt` to clients; keep the CA private key on the server.

Caddy stores its CA in a Docker volume named `caddy_data`.
Keep this volume to retain certificate trust after a restart.
To stop this setup, run:

```sh
docker compose -f compose.yaml -f compose.lan.yaml down
```

For an existing HTTPS proxy, set `VMODEL_ORIGIN` to the exact browser origin in the VModel container.
An origin consists of the scheme, host, and optional port, such as `https://studio.example:8443`.
Configure the proxy to preserve the `Host` header.
The server rejects hosts and browser origins that do not match its configuration.
`VMODEL_HOST` controls the listen address; Docker sets this value to `0.0.0.0`.
The Windows launcher retains its default listen address, `127.0.0.1`.

## Models and stored data

The build includes prepared Ene and Rei files from `public/avatars` when those files are present.
It retains their supplied notices and creates model thumbnails.
These private model files are absent from a fresh code checkout.
If you need Ene and Rei, prepare their files before the Docker build.
Otherwise, use **Library** to import a VRM file that you can use under its model terms.
Keep images that contain private models in private storage.

The browser stores imported models, settings, and calibration.
Different browsers and origins have separate stored data.
Use the Library backup controls before you change the server address.
See the [model library guide](model-library.md).

Open the output window from the studio in the same browser on the same computer.
The studio does not send output frames between computers.
OBS and the separate voice services still run outside this container.
The Windows OBS attachment scripts retain their local server requirements.

## Checks

To check container status, run `docker compose ps`.
To read server errors, run `docker compose logs vmodel`.
For the network setup, include `-f compose.yaml -f compose.lan.yaml` in these commands.
`/health` returns the application name when the server runs.

To test the production server with a simulated camera, run:

```sh
npm run test:deployment
```

This check needs a local build and Playwright Chromium.
It also needs the prepared Ene model in the build.
Set `VMODEL_TEST_URL` to test a running container instead of a temporary local server.
The test covers camera permission, tracking, camera stop, output, and server policy.
A physical camera check still needs a person.
