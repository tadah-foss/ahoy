const { Client, Intents, MessageEmbed } = require("discord.js")
const fetch = require("node-fetch")
const fs = require("fs")
const humanizeDuration = require("humanize-duration")
const path = require("path")
const shell = require("child_process")
const log = require("./logger")

const GITHUB_USER_API = "https://api.github.com/users/"
var DEVELOPER_LOOKUP_TABLE = {}

let lookups = (process.env.DEVELOPERS).split(",")
for (let i = 0; i < lookups.length; i++) {
    let user = lookups[i].split("=")
    DEVELOPER_LOOKUP_TABLE[user[0]] = user[1]
}

humanize = (s) => humanizeDuration(s * 1000)

var client = new Client({ intents: [Intents.FLAGS.GUILDS] })

function getCommitInfo() {
    return new Promise((resolve, reject) => {
        // thank god Git is made by Torvalds so it's LF

        let description = shell.execSync(`cd ${process.env.TADAH_PATH} && git log -1 --pretty=%B`).toString()
        description = description.split("\n")
        delete description[0]
        description = description.join("\n").replace(/(\r\n|\n|\r)/gm, "").trim()

        if (!description) {
            description = "*No description provided.*"
        }

        // this is so fucking stupid
        let author = { username: "", avatar: "", url: "" }
        let email = shell.execSync(`cd ${process.env.TADAH_PATH} && git log -1 --pretty=format:'%ae'`).toString().trim()

        let lookedUp = DEVELOPER_LOOKUP_TABLE[email]
        if (!lookedUp) lookedUp = ""

        fetch(GITHUB_USER_API + lookedUp)
            .then(res => res.json())
            .then((data) => {
                if (data.message == "Not Found") {
                    author.username = shell.execSync(`cd ${process.env.TADAH_PATH} && git log -1 --pretty=format:'%an'`).toString().trim()
                    delete author.avatar
                    delete author.url
                } else {
                    author.username = data.login
                    author.avatar = data.avatar_url
                    author.url = data.html_url
                }

                resolve({ description, author })
            })
    })
}

function yell(wid, buildTime, downTime, deployTime, mixTime) {
    log.info(`[${wid}] Yelling!`)
    getCommitInfo().then((result) => {
        let embed = {
            title: "",
            "description": result.description,
            color: 0x455dd8,
            author: { name: result.author.username },
            fields: [
                {
                    name: "Total Deploy Time",
                    value: humanize(deployTime),
                    inline: true
                },
                {
                    name: "Build Time",
                    value: humanize(buildTime),
                    inline: true
                },
                {
                    name: "Mix Time",
                    value: humanize(mixTime),
                    inline: true
                },
                {
                    name: "Downtime",
                    value: humanize(downTime),
                    inline: true
                }
            ],
            timestamp: new Date(),
            footer: { text: `WID: ${wid}` }
        }

        if (result.author.hasOwnProperty("avatar")) {
            embed.author.icon_url = result.author.avatar
            embed.author.url = result.author.url
        }

        client.channels.cache.get(process.env.DEPLOY_LOG_CHANNEL_ID).send({ content: "**New Tadah version!**", embeds: [embed] })
        log.info(`[${wid}] Yelled!`)
    })
}

function login() {
    client.login(process.env.YELLER_TOKEN)
    client.on("ready", () => { log.info("Logged into Yeller") })
}

function error(wid, code, exception = "") {
    // 0 = general exception
    // 1 = timed out (race condition)
    if (code < 0 || code > 1) throw "Invalid yeller error code"
    let exceptionName
    switch (code) {
        case 0:
            exceptionName = "GENERAL_EXCEPTION"
            break
        case 1:
            exceptionName = "TIMED_OUT"
            break
        default:
            exceptionName = "UNKNOWN_EXCEPTION"
    }

    client.channels.cache.get(process.env.DEPLOY_ERROR_CHANNEL_ID).send(`An unexpected error occurred during a deploy.\n\nInternally, it was a \`${exceptionName}\`.\nThe WID was \`${wid}\`.\nThe full exception:\n\`\`\`${exception.stack}\`\`\`\n\n<@&${process.env.DEVELOPER_ROLE_ID}>`)
    log.info(`[${wid}] Yelled the error!`)
}

module.exports = { login, yell, error }