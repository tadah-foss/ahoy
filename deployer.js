const fs = require("fs")
const shell = require("child_process")
const split = require("split")
const path = require("path")
const moment = require("moment")

const log = require("./logger")

function stripAnsi(text) {
    return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
}

function dump(wid) {
    return new Promise((resolve, reject) => {
        let result = ""

        fs.createReadStream(path.join(__dirname, "latest.log"), "utf8").pipe(split())
            .on("data", (line) => { if (line.indexOf(wid) > -1) result += `${line},` })
            .on("close", () => {    
                let json = JSON.parse(`[${result.slice(0, -1)}]`)
                let filtered = []
                let { buildEnded, buildStarted, downEnded, downStarted, mixStarted, mixEnded } = 0

                for (let i = 0; i < json.length; i++) {                    
                    let message = json[i].message.split("\n")[0].replace(/(\r\n|\n|\r)/gm, " ").trim()
                    let buildType = message.split("=")[0].trim().split(" ").at(-1).trim()

                    switch (buildType) {
                        case "BUILD_STARTED":
                            buildStarted = parseInt(message.split("=")[1].trim())
                            break
                        case "BUILD_ENDED":
                            buildEnded = parseInt(message.split("=")[1].trim())
                            break
                        case "DOWNTIME_STARTED":
                            downStarted = parseInt(message.split("=")[1].trim())
                            break
                        case "DOWNTIME_ENDED":
                            downEnded = parseInt(message.split("=")[1].trim())
                            break
                        case "MIX_STARTED":
                            mixStarted = parseInt(message.split("=")[1].trim())
                            break
                        case "MIX_ENDED":
                            mixEnded = parseInt(message.split("=")[1].trim())
                            break
                        default:
                            filtered.push(`${moment(json[i].timestamp).format("MM/DD/YY - h:mm:ss A")} | ${json[i].message.replace(/(\r\n|\n|\r)/gm, "").trim()}`)
                    }
                }

                resolve({
                    dump: filtered.join(`\n`),
                    buildTime: buildEnded - buildStarted,
                    downTime: downEnded - downStarted,
                    mixTime: mixEnded - mixStarted
                })
            })
    })
}

function deploy(wid) {
    return new Promise(async (resolve, reject) => {
        log.info(`[${wid}] Event receieved`)

        fs.writeFileSync(path.join(__dirname, "DEPLOYING"), "Don't touch me! Otherwise, a race condition will occur. I get deleted automatically!")
        
        if (!fs.existsSync(path.join(__dirname, "deploy.sh"))) {
            throw "No deploy script exists"
        }

        log.info(`[${wid}] Running script`)
        let child = shell.exec(`${path.join(__dirname, "deploy.sh")} -n ${process.env.NGINX_PATH} -w ${process.env.NGINX_WWW_PATH} -t ${process.env.TADAH_PATH}`)
    
        child.stdout.on("data", (data) => { log.info(`[${wid}] ${stripAnsi(data)}`) })
        child.stderr.on("data", (data) => { log.info(`[${wid}] ${stripAnsi(data)}`) })
    
        child.on("close", () => {
            log.info(`[${wid}] Script closed.`)
            fs.unlinkSync(path.join(__dirname, "DEPLOYING"))

            dump(wid).then((result) => { resolve(result) })
        })
    })
}

module.exports = { deploy, dump }