const { expect } = require('chai');
const faker = require('faker');
const util = require('util');

describe('logging hook index', () => {

  it('Updates a Players country on connectedMessage event', async () => {
    const playerConnectedEvent = {
      steamId: '76561198028175941',
      playerName: 'Catalysm',
      entityId: '171',
      ip: '192.168.1.1',
      date: '2020-07-20',
      time: '22:01:19',
      uptime: '493.113',
      msg: 'Player connected, entityid=171, name=Catalysm, steamid=76561198028175941, steamOwner=76561198028175941, ip=192.168.1.1',
      country: 'BE',
      player: {
        createdAt: 1591719367715,
        updatedAt: 1594845768431,
        id: 27,
        steamId: '76561198028175941',
        entityId: 171,
        ip: '192.168.1.1',
        country: null,
        currency: 0,
        avatarUrl: '',
        name: 'Catalysm',
        positionX: -1279,
        positionY: 61,
        positionZ: 209,
        inventory: {
          steamid: '76561198028175941',
          entityid: 171,
          bag: [Array],
          belt: [Array],
          equipment: [Object]
        },
        playtime: 70,
        lastOnline: '2020-07-15T20:36:01Z',
        banned: false,
        deaths: 0,
        zombieKills: 0,
        playerKills: 0,
        score: 0,
        level: 1,
        lastTeleportTime: '2020-06-09 18:14:59.737',
        server: 254,
        user: 3,
        role: 9
      },
      server: {
        createdAt: 1591719367580,
        updatedAt: 1594496008913,
        id: 254,
        name: 'CSMM Dev',
        ip: '7d2d.csmm.app',
        webPort: 80,
        owner: 3
      },
      type: 'playerConnected'
    };
    await sails.hooks.sdtdlogs.start(sails.testServer.id);
    const loggingObject = await sails.hooks.sdtdlogs.getLoggingObject(sails.testServer.id);
    sandbox.spy(Player, 'update');
    sandbox.stub(sails.hooks.discordnotifications, 'sendNotification').callsFake(() => { });

    const oncePromise = new Promise(resolve => loggingObject.once('playerConnected', resolve));
    loggingObject.emit('playerConnected', playerConnectedEvent);
    await oncePromise;

    // Sails adds a updatedAt property to the call so we check the args instead of the full call
    expect(Player.update.args[0][0]).to.eql({ server: sails.testServer.id, steamId: '76561198028175941' });
    expect(Player.update.args[0][1].country).to.equal('BE');

  });

  describe('getLoggingObject', () => {

    it('Returns an instance of LoggingObject', async () => {
      // Have to require inside the test because sails does weird stuff
      // See: https://github.com/CatalysmsServerManager/7-days-to-die-server-manager/pull/370
      const LoggingObject = require('../../../../api/hooks/sdtdLogs/LoggingObject');
      const res = await sails.hooks.sdtdlogs.getLoggingObject(sails.testServer.id);
      expect(res).to.be.instanceOf(LoggingObject);
    });

    it('Creates a loggingObject when one doesnt exist yet', async () => {
      const LoggingObject = require('../../../../api/hooks/sdtdLogs/LoggingObject');
      await sails.hooks.sdtdlogs.stop(sails.testServer.id);
      const res = await sails.hooks.sdtdlogs.getLoggingObject(sails.testServer.id);
      expect(res).to.be.instanceOf(LoggingObject);
    });

    it('Returns an inactive loggingObject when a server is inactive', async () => {
      const LoggingObject = require('../../../../api/hooks/sdtdLogs/LoggingObject');

      //await sails.hooks.sdtdlogs.stop(sails.testServer.id);
      await sails.helpers.meta.setServerInactive(sails.testServer.id);
      const res = await sails.hooks.sdtdlogs.getLoggingObject(sails.testServer.id);
      expect(res).to.be.instanceOf(LoggingObject);
      expect(res.active).to.not.be.ok;
    });

  });


  describe('initialize', () => {

    it('Only starts servers that are active', async () => {
      const initialize = util.promisify(sails.hooks.sdtdlogs.initialize);

      const inactiveServer = await SdtdServer.create({
        name: faker.company.companyName(),
        ip: 'localhost',
        webPort: '8082',
        authName: faker.random.alphaNumeric(20),
        authToken: faker.random.alphaNumeric(20),
        owner: sails.testUser.id
      }).meta({ skipAllLifecycleCallbacks: true }).fetch();

      await SdtdConfig.create({
        server: inactiveServer.id,
        inactive: true,

      }).meta({ skipAllLifecycleCallbacks: true }).fetch();

      await initialize();

      const logObjActive = await sails.hooks.sdtdlogs.getLoggingObject(sails.testServer.id);
      const logObjInactive = await sails.hooks.sdtdlogs.getLoggingObject(inactiveServer.id);

      expect(logObjActive.active).to.be.true;
      expect(logObjInactive.active).to.be.false;

    });

  });

});
