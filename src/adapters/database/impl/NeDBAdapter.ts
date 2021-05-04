import Datastore from "nedb";
import {DatabaseAdapter} from "../DatabaseAdapter";
import {Playlist, Setting, Song} from "../../../Types";
import Log from "../../../util/Log";

enum Entity {
    SONGS = "songs",
    PLAYLISTS = "playlists",
    REFRESH_TOKEN = "token",
}

type Collection = Entity | Setting

interface DBConfig<T> {
    _id?: string;
    value: T;
    guild: string;
}

interface DBSong extends Song {
    _id?: string;
    guild: string;
}

interface DBPlaylist extends Song {
    _id?: string;
    guild: string;
}

const collections: Map<Collection, Datastore> = new Map();

const getCollection = (collection: Collection): Datastore => {
    if (!collections.has(collection)) {
        const dataStore = new Datastore({filename: `./db/${collection}.db`, autoload: true});
        collections.set(collection, dataStore);
    }
    return collections.get(collection);
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
    const query = {guild, $and:[{time: {$gt: from}}, {time: {$lt: until}}]};
    const cursor = getCollection(Entity.SONGS).find(query).sort({time: 1});
    const documents = await promisifyNeDB<DBSong[]>(cursor.exec.bind(cursor))();
    const songs: Song[] = documents.map((song): Song => {
        const {name, link, length, source, requester, skipped} = song;
        return {name, link, length, source, requester, skipped};
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

const listPlaylists = async (guild: string): Promise<Playlist[]> => {
    const query = {guild};
    const cursor = getCollection(Entity.PLAYLISTS).find(query).sort({time: 1});
    const documents = await promisifyNeDB<DBPlaylist[]>(cursor.exec.bind(cursor))();
    const playlists: Playlist[] = documents.map((song): Playlist => {
        const {name, link, source} = song;
        return {name, link, source};
    });
    Log.info(`Retrieved ${documents.length} playlists for guild ${guild}`);
    return playlists;
};

const getSetting = async <T>(guild: string, setting: Setting): Promise<T> => {
    const prefixCollection = getCollection(setting);
    const query = {guild};
    const document = await promisifyNeDB<DBConfig<T>>(prefixCollection.findOne.bind(prefixCollection))(query);
    Log.debug(`Retrieved ${setting} "${document.value}" for guild ${document.guild}`);
    return document?.value ?? null;
};

const setSetting = async <T>(guild: string, setting: Setting, value: T): Promise<void> => {
    Log.debug(`Setting ${setting}:`, value);
    const config = {value, guild};
    const collection = getCollection(setting);
    return promisifyNeDB<void>(collection.update.bind(collection))({guild}, config, {upsert: true});
};

const getRefreshToken = async (): Promise<string> => {
    const collection = getCollection(Entity.REFRESH_TOKEN);
    const query = {};
    const document = await promisifyNeDB<{refresh: string}>(collection.findOne.bind(collection))(query);
    return document.refresh;
};

const setRefreshToken = (refresh: string): Promise<void> => {
    const collection = getCollection(Entity.REFRESH_TOKEN);
    return promisifyNeDB<void>(collection.update.bind(collection))({}, {refresh}, {upsert: true});
};

export const NeDBAdapter: DatabaseAdapter = {
    getSetting,
    setSetting,
    addSong,
    getSongsBetween,
    getLatestSong,
    skipSong,
    addPlaylist,
    listPlaylists,
    getRefreshToken,
    setRefreshToken,
};
