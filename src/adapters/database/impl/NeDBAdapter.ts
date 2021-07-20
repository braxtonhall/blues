import Datastore from "nedb";
import {DatabaseAdapter} from "../DatabaseAdapter";
import {Playlist, Range, Setting, Song, Source, Watcher} from "../../../Types";
import Log from "../../../util/Log";
import {ConfigKey, getConfig} from "../../../util/Config";

enum Entity {
    SONGS = "songs",
    PLAYLISTS = "playlists",
    WATCHERS = "watchers",
}

type Collection = Entity | Setting

interface DBConfig<T> {
    _id?: string;
    value: T;
    guild: string;
}

interface TimezoneConfig {
    _id?: string;
    timezone: string;
    id: string;
}

interface DBSong extends Song {
    _id?: string;
    guild: string;
}

interface DBPlaylist extends Playlist {
    _id?: string;
    guild: string;
}

interface DBWatcher extends Watcher {
    _id?: string;
}

interface DBToken {
    token: string;
    createdAt: number; // in seconds
}

let tokenCollection; // treated differently than the others
const collections: Map<Collection, Datastore> = new Map();

const getCollection = (collection: Collection): Datastore => {
    if (!collections.has(collection)) {
        const dataStore = new Datastore({filename: `./db/${collection}.db`, autoload: true});
        collections.set(collection, dataStore);
    }
    return collections.get(collection);
};

const getTokenCollection = async (): Promise<Datastore> => {
    if (!tokenCollection) {
        tokenCollection = new Datastore({
            filename: `./db/tokens.db`,
            autoload: true,
            timestampData: true
        });
        const executor = promisifyNeDB(tokenCollection.ensureIndex.bind(tokenCollection));
        await executor({ fieldName: 'createdAt', expireAfterSeconds: Number(getConfig(ConfigKey.tokenLifeTime))});
    }
    return tokenCollection;
};

const promisifyNeDB = <T>(fn: (...args: [...any[], (e, r: T) => void]) => void): (...args: any[]) => Promise<T> =>
    (...args: any[]) => new Promise((resolve, reject) => {
        const callback = (err, result) => {
            if (err) {
                return reject(err);
            } else{
                return resolve(result);
            }
        };
        fn(...args, callback);
    });

const addSong = (guild: string, song: Song): Promise<void> => {
    Log.info(`Saving "${song.name}" song to the db`);
    const time = Date.now();
    const songCollection = getCollection(Entity.SONGS);
    return promisifyNeDB<void>(songCollection.insert.bind(songCollection))({...song, time, guild});
};

const getLatestSong = async (guild: string): Promise<Song> => {
    Log.debug("Getting latest song from the db");
    const cursor = getCollection(Entity.SONGS).find({guild}).sort({time: -1}).limit(1);
    const documents = await promisifyNeDB<DBSong[]>(cursor.exec.bind(cursor))();

    if (!documents) {
        throw new Error("No latest song exists");
    }
    const [dbSong] = documents;
    dbSong && delete dbSong._id; // So no one can get a hold of it!
    return dbSong;
};

const skipSong = (guild: string, song: Song): Promise<void> => {
    Log.debug(`Skipping ${song.name} in the db`);
    const songCollection = getCollection(Entity.SONGS);
    return promisifyNeDB<void>(songCollection.update.bind(songCollection))({...song, guild}, {$set: {skipped: true}}, {});
};

const getSongsBetween = async (guild: string, from: number, until: number): Promise<Song[]> => {
    const query = {guild, $and:[{time: {$gt: from}}, {time: {$lt: until}}], skipped: false};
    const cursor = getCollection(Entity.SONGS).find(query).sort({time: 1});
    const documents = await promisifyNeDB<DBSong[]>(cursor.exec.bind(cursor))();
    const songs: Song[] = documents.map((song): Song => {
        const {name, link, length, source, requester, skipped, time} = song;
        return {name, link, length, source, requester, skipped, time};
    });
    Log.info(`Retrieved ${documents.length} songs for guild ${guild}`);
    return songs;
};

const addPlaylist = (guild: string, playlist: Playlist): Promise<void> => {
    Log.info(`Saving "${playlist.name}" playlist to the db`);
    const time = Date.now();
    const playlistCollection = getCollection(Entity.PLAYLISTS);
    return promisifyNeDB<void>(playlistCollection.insert.bind(playlistCollection))({...playlist, time, guild});
};

const getPlaylist = async (guild: string, source: Source, range: Range, requester: string): Promise<Playlist> => {
    const query = {guild, source, range, requester};
    const cursor = getCollection(Entity.PLAYLISTS).find(query).sort({time: -1}).limit(1);
    const documents = await promisifyNeDB<DBPlaylist[]>(cursor.exec.bind(cursor))();
    const [playlist] = documents;
    playlist && delete playlist._id;
    Log.debug(`Retrieved playlist:`, playlist);
    return playlist;
};

const listPlaylists = async (guild: string): Promise<Playlist[]> => {
    const query = {guild};
    const cursor = getCollection(Entity.PLAYLISTS).find(query).sort({time: 1});
    const documents = await promisifyNeDB<DBPlaylist[]>(cursor.exec.bind(cursor))();
    const playlists: Playlist[] = documents.map((playlist): Playlist => {
        const {name, link, source, range, requester} = playlist;
        return {name, link, source, range, requester};
    });
    Log.info(`Retrieved ${documents.length} playlists for guild ${guild}`);
    return playlists;
};

const getSetting = async <T>(guild: string, setting: Setting): Promise<T> => {
    const prefixCollection = getCollection(setting);
    const query = {guild};
    const document = await promisifyNeDB<DBConfig<T>>(prefixCollection.findOne.bind(prefixCollection))(query);
    Log.debug(`Retrieved ${setting}`, document?.value, `for guild ${guild}`);
    return document?.value ?? null;
};

const setSetting = async <T>(guild: string, setting: Setting, value: T): Promise<void> => {
    Log.debug(`Setting ${setting}:`, value);
    const config = {value, guild};
    const collection = getCollection(setting);
    return promisifyNeDB<void>(collection.update.bind(collection))({guild}, config, {upsert: true});
};

const addToken = async (token: string): Promise<void> => {
    const tokenCollection = await getTokenCollection();
    return promisifyNeDB<void>(tokenCollection.insert.bind(tokenCollection))({token});
};

const hasToken = async (token: string): Promise<boolean> => {
    const tokenCollection = await getTokenCollection();
    const cursor = tokenCollection.find({token});
    const documents = await promisifyNeDB<DBToken[]>(cursor.exec.bind(cursor))();
    const [savedToken] = documents;
    return !!savedToken && savedToken.token === token;
};

const setTimezone = (id: string, timezone: string): Promise<void> => {
    Log.debug("Setting timezone:", timezone);
    const config = {id, timezone};
    const collection = getCollection(Setting.TIMEZONE);
    return promisifyNeDB<void>(collection.update.bind(collection))({id}, config, {upsert: true});
};

const getTimezone = async (id: string): Promise<string> => {
    const collection = getCollection(Setting.TIMEZONE);
    const query = {id};
    const document = await promisifyNeDB<TimezoneConfig>(collection.findOne.bind(collection))(query);
    Log.debug("Retrieved timezone", document?.timezone, `for id ${id}`);
    return document?.timezone ?? null;
};

const clearTimezone = (id: string): Promise<void> => {
    return setTimezone(id, null);
};

const addWatcher = (watcher: Watcher): Promise<void> => {
    const watchers = getCollection(Entity.WATCHERS);
    return promisifyNeDB<void>(watchers.insert.bind(watchers))(watcher);
};

const listWatchers = async (): Promise<Watcher[]> => {
    const query = {};
    const cursor = getCollection(Entity.WATCHERS).find(query);
    const documents = await promisifyNeDB<DBWatcher[]>(cursor.exec.bind(cursor))();
    documents.forEach((watcher) => delete watcher._id);
    Log.info(`Retrieved ${documents.length} watchers`);
    return documents;
};
const removeWatcher = (watcher: Watcher): Promise<void> => {
    const watchers = getCollection(Entity.WATCHERS);
    return promisifyNeDB<void>(watchers.remove.bind(watchers))(watcher);
};

export const NeDBAdapter: DatabaseAdapter = {
    getSetting,
    setSetting,
    addSong,
    getSongsBetween,
    getLatestSong,
    skipSong,
    addPlaylist,
    getPlaylist,
    listPlaylists,
    addToken,
    hasToken,
    setTimezone,
    getTimezone,
    clearTimezone,
    addWatcher,
    removeWatcher,
    listWatchers,
};
