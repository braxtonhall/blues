import fs from "fs";
import {MemeOption, MuteConfig, MuteOption, PruneOption, Range, Song, Source} from "../Types";
import {Message} from "discord.js";

const batchImport = (directory: string): Promise<any[]> => {
    const files = fs.readdirSync(directory)
        .filter((name) => name.match(/\.[tj]s$/));
    const futureImportedFiles = files
        .map((file) => import(`${directory}/${file}`));
    return Promise.all(futureImportedFiles);
};

const getSongRange = (songs: Song[]): Range =>
    ({start: songs[0]?.time ?? 0, end: (songs[songs.length - 1]?.time ?? 0) + (songs?.length ?? 0)});

const isSource = (maybeSource: any): maybeSource is Source =>
    Object.values(Source).includes(maybeSource);

const isMuteOption = (maybeMuteOption: any): maybeMuteOption is MuteOption =>
    Object.values(MuteOption).includes(maybeMuteOption);

const isMuteConfig = (maybeMuteConfig: any): maybeMuteConfig is MuteConfig =>
    maybeMuteConfig && typeof maybeMuteConfig === "object" &&
    isMuteOption(maybeMuteConfig.option) && typeof maybeMuteConfig.channel === "string";

const isMemeOption = (maybeMemeOption: any): maybeMemeOption is MemeOption =>
    Object.values(MemeOption).includes(maybeMemeOption);

const isPruneOption = (maybePruneOption: any): maybePruneOption is PruneOption =>
    Object.values(PruneOption).includes(maybePruneOption);

const getGuild = (message: Message): string => message.guild?.id ?? "";

const getUser = (message: Message): string => message.author.id ?? "";

export {
    batchImport,
    getSongRange,
    isSource,
    isMuteOption,
    isMemeOption,
    isPruneOption,
    isMuteConfig,
    getGuild,
    getUser
};
