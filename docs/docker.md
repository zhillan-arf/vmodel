# Docker setup

Docker serves the VModel studio to a browser.
The browser uses the camera on the computer where you open VModel.
The browser runs tracking and renders the model.
Camera images stay in that browser.
The container does not need a camera device or GPU.

Docker Compose is the tool that starts the containers in `compose.yaml`.
A Docker build creates an image from the application files.
Use Docker with Linux containers and Docker Compose v2.
The first build needs internet access for packages, tracking models, and the browser that creates model thumbnails.
After the build, the studio loads its runtime files from the server.

## Start the service

The default address is `https://10.12.1.193:4173`.
HTTPS protects the connection between the browser and the server.
Port 4173 accepts connections on all IPv4 interfaces.
Caddy is the HTTPS server in `deploy/compose.yaml`.
The VModel container accepts HTTP connections only inside the Docker network.

1. Open a terminal in the repository folder.
2. Start the service:

   ```sh
   ./deploy/manage.sh start
   ```

The script builds the application and waits for the containers to pass their health checks.
If Docker needs administrator access, the script uses `sudo`.
The script exports the public certificate to `deploy/vmodel-local-ca.crt`.
It does not change certificate trust on client computers.

To use Docker Compose directly, run these commands from the repository folder:

```sh
cd deploy
sudo docker compose up -d --build
./manage.sh cert
```

Docker uses `deploy/Dockerfile` and `deploy/Dockerfile.dockerignore` for the build.
The build context is the repository folder.
Docker Compose uses project name `vmodel` to keep existing containers and certificate volumes after the file move.
The default setup includes HTTPS; it does not need the former `compose.lan.yaml` file.

## Set up camera access

Browsers require a secure context for camera access.
A secure context uses trusted HTTPS or a local address such as `localhost`.
An HTTP address such as `http://10.12.1.193:4173` cannot provide camera access.
See the [browser camera requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

Caddy creates a local certificate authority (CA) that signs the server certificate.
Each client must trust this CA.
See [Caddy local HTTPS](https://caddyserver.com/docs/automatic-https#local-https).

1. If a firewall blocks port 4173, permit inbound TCP connections from your local network.
2. Copy `deploy/vmodel-local-ca.crt` from the server to each client through a trusted connection.
3. Install this certificate as a trusted root certificate on each client.
4. Restart the client browser.
5. Open `https://10.12.1.193:4173` in Chrome or Edge.
6. Select **Start camera**.
7. When the browser requests camera access, select **Allow**.

On Windows, use **Install Certificate**, then **Current User**, then **Trusted Root Certification Authorities**.
Other operating systems and browsers can use different certificate stores.
The browser must show a trusted connection before you start the camera.
Do not use a certificate warning bypass as the setup method.
Copy only the public certificate to clients; keep the CA private key on the server.

The browser can remember your camera permission.
If access fails, check camera permission in the browser and the operating system.
Close other applications that hold the camera.

## Control the service

Run these commands from the repository folder:

```sh
./deploy/manage.sh stop
./deploy/manage.sh start
./deploy/manage.sh restart
./deploy/manage.sh status
./deploy/manage.sh logs
./deploy/manage.sh cert
```

`restart` builds the application and replaces the containers.
`stop` removes the containers but keeps certificate storage.
Caddy stores its CA in the `caddy_data` Docker volume.
Keep this volume to keep certificate trust after a restart.
Do not use `docker compose down --volumes` unless you intend to replace the CA.
The script also works from other folders when you use its absolute path.

## Change the address or port

To change the defaults, copy `deploy/.env.example` to `deploy/.env`.
Set `VMODEL_DOMAIN` to the server IP address or DNS name.
Set `VMODEL_HTTPS_PORT` to the required TCP port.
For example:

```dotenv
VMODEL_DOMAIN=10.12.1.193
VMODEL_HTTPS_PORT=4180
```

Run `./deploy/manage.sh restart` to apply the change.
Then open `https://10.12.1.193:4180`.
If you use a DNS name, configure each client to resolve that name to the server address.
Move any existing Docker `.env` settings from the repository folder to `deploy/.env`.
Replace the former `VMODEL_HTTP_PORT` setting with `VMODEL_HTTPS_PORT`.
Port 4173 now uses HTTPS instead of HTTP.

`VMODEL_ORIGIN` identifies the browser origin in the VModel container.
An origin consists of the scheme, host, and optional port.
Docker Compose sets this value from the address and HTTPS port.
Caddy preserves the `Host` header.
The server rejects hosts and browser origins that do not match its configuration.
`VMODEL_HOST` controls the listen address; Docker sets this value to `0.0.0.0` inside the container.
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

To check container status, run `./deploy/manage.sh status`.
To read server errors, run `./deploy/manage.sh logs`.
To check HTTPS from the server, run:

```sh
curl --cacert deploy/vmodel-local-ca.crt https://10.12.1.193:4173/health
```

`/health` returns the application name when the server runs.

To test the production server with a simulated camera, run:

```sh
npm run test:deployment
```

This check needs a local build and Playwright Chromium.
It also needs the prepared Ene model in the build.
Set `VMODEL_TEST_URL` to test a running container instead of a temporary local server.
For HTTPS tests, configure Node.js and the test browser to trust the local CA.
The test covers camera permission, tracking, camera stop, output, and server policy.
A physical camera check still needs a person.
