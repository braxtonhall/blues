import {Playlist, Range, Setting, Song, Source, Watcher} from "../../Types";
import {NeDBAdapter} from "./impl/NeDBAdapter";

export interface DatabaseAdapter {
    // settings
    getSetting<T>(guild: string, setting: Setting): Promise<T>;
    setSetting<T>(guild: string, setting: Setting, value: T): Promise<void>;

    // songs
    addSong(guild: string, song: Song): Promise<void>;
    getLatestSong(guild: string): Promise<Song>;
    skipSong(guild: string, song: Song): Promise<void>;
    getSongsBetween(guild: string, from: number, until: number): Promise<Song[]>;

    // playlist
    addPlaylist(guild: string, playlist: Playlist): Promise<void>;
    getPlaylist(guild: string, source: Source, range: Range, requester: string): Promise<Playlist>;
    listPlaylists(guild: string): Promise<Playlist[]>;

    // timezone
    getTimezone(id: string): Promise<string>;
    setTimezone(id: string, timezone: string): Promise<void>;
    clearTimezone(id: string): Promise<void>;

    // watcher
    addWatcher(watcher: Watcher): Promise<void>;
    listWatchers(): Promise<Watcher[]>;
    removeWatcher(watcher: Watcher): Promise<void>;

    // tokens
    addToken(token: string): Promise<void>;
    hasToken(token: string): Promise<boolean>;
}

export const getDatabaseAdapter = (): DatabaseAdapter => NeDBAdapter;
