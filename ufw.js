const fetch = require("node-fetch")
const shell = require("child_process")

const GITHUB_META_API = "https://api.github.com/meta"

require("dotenv").config()

// assumes deny all in already

process.stdout.write("Creating GitHub Actions API rules...")

fetch(GITHUB_META_API)
    .then(res => res.json())
    .then(data => {
        for (let i = 0; i < data.actions.length; i++) {
            let ip = data.actions[i]
            shell.execSync(`ufw allow from ${ip} to any port ${process.env.AHOY_PORT} proto tcp`)
        }
    })
    .then(() => {
        console.log(` ${chalk.green("done!")}`)
    })
    .then(() => {
        console.log(chalk.green("Successfully created all UFW rules for Ahoy!"))
    })