# ahoy
Deploys Tadah images

## Configuration
| Key                       | Expected value                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `WEBHOOK_SECRET`          | The secret specified in the webhook configured with the GitHub repository                               |
| `WEBHOOK_NAME`            | Webhook name (default: "Ahoy")                                                                          |
| `WEBHOOK_PAYLOAD`         | Payload URL secret                                                                                      |
| `TADAH_PATH`              | Tadah source path, relative to the server file directory                                                |
| `NGINX_PATH`              | NGINX snippets path, relative to the server file directory, ex: /etc/nginx                              |
| `NGINX_HTML_PATH`         | NGINX WWW path, ex: /var/www                                                                            |
| `AHOY_PORT`               | What server port to run this on (default: 9000)                                                         |
| `YELLER_TOKEN`            | Yeller (Discord bot) bot application token                                                              |
| `DEPLOY_LOG_CHANNEL_ID`   | Ahoy deploy logd Discord channel ID                                                                     |
| `DEPLOY_ERROR_CHANNEL_ID` | Ahoy error log Discord channel ID                                                                       |
| `DEVELOPER_ROLE_ID`       | Discord Developer role ID (or whoever important to ping)                                                |
| `DEVELOPERS`              | Equal sign separated list of developers (i.e. `github_email@mail.com=developer1)`)                      |

## Usage
1. Configure and deploy on the server
2. Add required secrets
3. Add the sample workflow to repository
4. Voila

## Workflow
See example-workflow.yml as an example. You need to then add `AHOY_HOSTNAME`, `AHOY_PAYLOAD`, and `AHOY_SECRET` to the GitHub repository. Place the workflow in the branch, with the path `.github/workflows/ahoy.yml`.

## Notes
- Assumes NPM and Git are installed
- a+rwx should be on source code folder
- NPM should be installed already (for Laravel Mix)
- Run with `sudo pm2 start .`. You *need* sudo
- UFW should be denying all incoming traffic by default, and should only be allowing the IP ranges that GitHub Actions uses for `AHOY_PORT`. You may block ports via `sudo ufw deny $port`, or automatically import all UFW configuration by running `sudo npm ufw`. You should probably only run the UFW command upon initial setup (meaning, do it once.)
- `deploy.sh` is an executable - run `chmod +x deploy.sh`

## License
~~Copyright Tadah 2021. All rights reserved~~

Licensed under the GNU Affero General Public License v3.0. A copy of it [has been included](https://github.com/tadah-foss/ahoy/blob/trunk/LICENSE). This repository was archived in its original state on January 17th, 2023, with the last modification being made on December 17th, 2021.
