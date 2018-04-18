const sevenDays = require('machinepack-7daystodiewebapi');
const CustomCommand = require('./customCommand.js');

/**
     * @memberof module:SdtdCommandsHook
     * @name commandHandler
     * @param {number} serverId
     * @param {loggingObject} loggingObject Obtained from the logging hook
     * @param {json} config Server commands config
     * @description Handles ingamecommands on a server
     */


class CommandHandler {
  constructor(serverId, loggingObject, config) {
    this.serverId = serverId;
    this.loggingObject = loggingObject;
    this.config = config;
    this.commands = CommandHandler.loadCommands.bind(this)();
    this.commandListener = CommandHandler.commandListener.bind(this);
    this.start();
  }
  /**
       * Start listening for commands
       */
  start() {
    this.commands = CommandHandler.loadCommands.bind(this)();
    let listenerFunction = this.commandListener;
    this.loggingObject.on('chatMessage', listenerFunction);
  }

  /**
       * Stop listening for commands
       */

  stop() {
    let listenerFunction = this.commandListener;
    this.loggingObject.removeListener('chatMessage', listenerFunction);
  }

  /**
       * Load commands
       * @returns {Map}
       */

  static loadCommands() {

    let commands = new Map();
    let config = this.config;

    const normalizedPath = require('path').join(__dirname, 'commands');

    require('fs').readdirSync(normalizedPath).forEach(function (file) {
      let command = require('./commands/' + file);
      commands.set(command.name.toLowerCase(), new command(config.server));

    });

    return commands;

  }

  /**
       * Attached to the logging event emitter
       * @param {json} chatMessage
       */

  static async commandListener(chatMessage) {

    try {
      if (chatMessage.messageText.startsWith(this.config.commandPrefix)) {
        // Cut out the prefix
        let trimmedMsg = chatMessage.messageText.slice(this.config.commandPrefix.length, chatMessage.messageText.length);

        let splitString = trimmedMsg.split(' ');
        let commandName = splitString[0];
        let args = splitString.splice(1, splitString.length);

        let player = await Player.find({ name: _.trim(chatMessage.playerName), server: this.config.server });
        let playerInfo = await sails.helpers.loadPlayerData.with({ serverId: this.config.server, steamId: player[0].steamId })
        player = playerInfo.players[0]
        let server = await SdtdServer.findOne(player.server).populate('players');
        let config = await SdtdConfig.findOne({ server: server.id });
        server.config = config;

        // Function to easily reply to players in a command
        chatMessage.reply = async message => await sendReplyToPlayer(server, player, message);

        // If the commandName is a recognized CSMM command, we run it.
        if (this.commands.has(commandName)) {
          let commandToRun = this.commands.get(commandName);
          sails.log.info(`HOOK SdtdCommands - command ran by player ${player.name} on server ${server.name} - ${chatMessage.messageText}`)
          return commandToRun.run(chatMessage, player, server, args);
        }

        // Else we try to find a custom command that matches the commandName
        let customCommands = await sails.models.customcommand.find({
          server: this.serverId,
          enabled: true,
          name: commandName
        });

        customCommands.forEach(command => {
          let commandClass = new CustomCommand(this.serverId);
          commandClass.run(chatMessage, player, server, args);
        })


        sails.log.debug(`HOOK SdtdCommands:commandListener - Unknown command used by ${chatMessage.playerName} on server ${this.config.server.name}`);
      }
    } catch (error) {
      sails.log.error(`HOOK SdtdCommands:commandListener - ${error}`);
    }



  }
}

module.exports = CommandHandler;


async function sendReplyToPlayer(server, player, message) {
  return new Promise((resolve, reject) => {
    return sevenDays.sendMessage({
      ip: server.ip,
      port: server.webPort,
      authName: server.authName,
      authToken: server.authToken,
      message: `${message}`,
      playerId: player.steamId
    }).exec({
      error: (error) => {
        sails.log.error(`HOOK - SdtdCommands - Failed to respond to player`);
        reject(error)
      },
      success: (result) => {
        resolve(result)
      }
    });
  })
}