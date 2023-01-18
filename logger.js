const winston = require("winston")
const path = require("path")

const logger = (winston.createLogger)({
    format: (winston.format).combine((winston.format).timestamp(), (winston.format).json()),
    transports: [
        new (winston.transports.Console)({
            timestamp: () => (new Date()).toLocaleTimeString(),
            colorize: true,
            level: "info"
        }),
        new (winston.transports.File)({
            filename: path.join(__dirname, "latest.log"),
            level: "info"
        })
    ]
})

module.exports = logger