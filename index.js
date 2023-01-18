const bodyParser = require("body-parser")
const compare = require("safe-compare")
const crypto = require("crypto")
const fs = require("fs")
const express = require("express")
const humanizeDuration = require("humanize-duration")
const moment = require("moment")
const path = require("path")
const uuid = require("uuid")

// move old log
if (fs.existsSync(path.join(__dirname, "latest.log"))) {
    if (!fs.existsSync(path.join(__dirname, "logs"))) fs.mkdirSync(path.join(__dirname, "logs"))

    fs.renameSync(path.join(__dirname, "latest.log"), path.join(__dirname, "logs", `${new Date().toISOString()}.log`))
}

require("dotenv").config()

const deployer = require("./deployer")
const log = require("./logger")
const yeller = require("./yeller")
const sleep = ms => new Promise(res => setTimeout(res, ms))

if (!fs.existsSync(path.join(__dirname, ".env"))) {
    log.error("No dotenv file specified")
    process.exit(1)
}

humanize = (s) => humanizeDuration(s * 1000)

// Website
let app = express()

app.use(bodyParser.json({ 
    verify: (req, res, buf) => { req.rawBody = buf }
}))

app.use((err, req, res, next) => {
    if (req.path !== process.env.WEBHOOK_PAYLOAD) {
        // Give false bad gateway
        log.info(`Request received to path other than webhook main payload from ${req.socket.remoteAddress}`)
        return res.status(DEFAULT_ERROR_RESPONSE)
    }

    next()
})

app.post(`/${process.env.WEBHOOK_PAYLOAD}`, async (req, res) => {
    let started = moment().unix()

    let wid = uuid.v4()
    log.info(`[${wid}] Received deploy request from ${req.socket.remoteAddress}`)

    // We need to verify that 4 headers exist:
    let requirements = [
        "x-github-delivery",
        "x-github-event",
        "x-hub-signature",
        "x-hub-signature-256",
    ]

    let count = 0
    for (const requirement of requirements) {
        if (req.headers.hasOwnProperty(requirement)) count += 1
    }

    if (count != requirements.length) {
        log.error(`[${wid}] Failure - Request received, failed the required header check`)
        return res.status(405)
    }

    // Verify content type
    if (!compare(req.headers["content-type"], "application/json")) {
        log.error(`[${wid}] Failure - Request received with wrong content type`)
        return res.status(405)
    }

    // Now we have to verify that the Sha256 signature is correct.
    // It is the HMAC hex digest of the request body and is generated using the webhook secret as the HMAC key.
    let signature = crypto.createHmac("sha256", process.env.WEBHOOK_SECRET).update(req.rawBody).digest("hex")
    signature = `sha256=${signature}`

    if (!compare(signature, req.headers["x-hub-signature-256"])) {
        log.error(`[${wid}] Failure - Event had invalid signature`)
        return res.status(403)
    } else {
        log.info(`[${wid}] Good signature check. Recieved: "${req.headers["x-hub-signature-256"]}", ours: "${signature}"`)
    }

    // This is a legitimate request.

    // Is the event a push?
    if (req.headers["x-github-event"] != "push" || req.body.event != "push") {
        log.error(`[${wid}] Failure - Event was not a push`)
        return res.status(405)
    }

    log.info(`[${wid}] Deploying...`)

    try {
        if (fs.existsSync(path.join(__dirname, "DEPLOYING"))) {
            log.warn(`[${wid}] Currently deploying, trying 10 times for 20 seconds each...`)
            let count = 0
            for (let i = 0; i < 10; i++) {
                count += 1
                log.info(`[${wid}] Attempt ${i} of 10...`)
                await sleep(20000)
                if (fs.existsSync(path.join(__dirname, "DEPLOYING")) && count >= 10) {
                    log.error(`[${wid}] Failed, timed out for deploy.`)
                    deployer.dump(wid).then((result) => {
                        res.status(500).send(result.dump + `\n\nA deploy was currently running which timed out.\n\n(took ${humanize(moment().unix() - started)})`)
                        yeller.error(wid, 1)
                    })
                }

                if (!fs.existsSync(path.join(__dirname, "DEPLOYING"))) break
    
            }
        }

        deployer.deploy(wid).then((result) => {
            log.info(`[${wid}] FINISHED - Deploy completed! (took ${humanize(moment().unix() - started)} seconds, started at unix timestamp ${started})`)
            res.status(201).send(result.dump + `\n\nSuccessfully deployed!\n(build time: ${humanize(result.buildTime)}, mix time: ${humanize(result.mixTime)}, down time: ${humanize(result.downTime)}, total deploy time: ${humanize(moment().unix() - started)})`)
            yeller.yell(wid, result.buildTime, result.downTime, moment().unix() - started, result.mixTime)
        })
    } catch (e) {
        log.error(`[${wid}] EXCEPTION OCCURED on deploy!`)
        log.error(`[${wid}] FAILURE REASON - '${e}'`)
        log.error(`[${wid}] FAILURE STACK - ${e.stack}`)

        deployer.dump(wid).then((result) => {
            res.status(500).send(result.dump + `\n\nFailed to deploy.\n(took ${humanize(moment().unix() - started)})\n\nstack: ${e.stack}\nexception: ${e}`)
            yeller.error(wid, 0, e)
        })
    }
})

// Start
app.listen(process.env.AHOY_PORT, () => {
    log.info(`Ahoy running, listening for pushes on port ${process.env.AHOY_PORT}`)
})
yeller.login(process.env.YELLER_TOKEN, process.env.DEPLOY_LOG_CHANNEL_ID, process.env.DEPLOY_ERROR_CHANNEL_ID, process.env.DEVELOPER_ROLE_ID)

if (!fs.existsSync(path.join("/var", "www", "maintenance"))) fs.mkdirSync(path.join("/var", "www", "maintenance"))
