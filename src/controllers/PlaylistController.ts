import {Playlist, Range, SearchResult, Song, Source} from "../Types";
import {getPlatformAdapter} from "../adapters/platforms/PlatformAdapterFactory";
import Log from "../util/Log";
import moment from "moment";

const createPlaylist = async (songs: Song[], source: Source): Promise<Playlist> => {
    const platformAdapter = getPlatformAdapter(source);
    const name = createName(songs);
    const playlistLink = await platformAdapter.createPlaylist(name);
    for (const song of songs) {
        if (song.source === source) {
            await platformAdapter.addToPlaylist(playlistLink, song.link);
        } else {
            const searchResults = await platformAdapter.search(song.name);
            const matchingSearchResult = selectBestSearchResult(song, searchResults);
            if (matchingSearchResult) {
                await platformAdapter.addToPlaylist(playlistLink, matchingSearchResult.link);
            }
        }
    }
    const range = getPlaylistRange(songs);
    return {link: playlistLink, name, source, range};
};

const createName = (songs: Song[]): string => {
    const first = songs[0];
    const last = songs[songs.length - 1];
    const firstDate = moment(first.time).format("YYYY-MM-DD");
    const lastDate = moment(last.time).format("YYYY-MM-DD");
    if (firstDate === lastDate) {
        return firstDate;
    } else {
        return `${firstDate} - ${lastDate}`;
    }
};

const getPlaylistRange = (songs: Song[]): Range =>
    ({start: songs[0].time, end: songs[songs.length - 1].time + songs.length});

const selectBestSearchResult = (originalSong: Song, songLinks: SearchResult[]): SearchResult => {
    // TODO implement stub
    Log.info(originalSong, songLinks[0]);
    return songLinks[0];
};

export default {createPlaylist};
