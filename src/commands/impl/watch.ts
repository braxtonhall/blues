import {CommandBinder} from "../Command";
import {Client, Guild, GuildMember, Message} from "discord.js";
import {getGuild, getUser} from "../../util/Util";
import {getDatabaseAdapter} from "../../adapters/database/DatabaseAdapter";
import {Watcher} from "../../Types";
import cheerio from "cheerio";
import axios from "axios";

const database = getDatabaseAdapter();

const watch: CommandBinder = (client: Client) => {
    const fiveMinutesMs = 5 * 60 * 1000;
    setInterval(notifyWatchers(client), fiveMinutesMs);

    return {
        name: "watch",
        description: "Adds a discogs item to your watch list",
        usage: "watch <delete = delete>? <link>",
        procedure: async (message: Message, args: string[]) => {
            const link = args.pop();
            let reply;
            if (!link) {
                reply = "Link to item's sell page required";
            } else if (!/https:\/\/www\.discogs\.com\/sell\/release\/[0-9]+/.test(link)) {
                reply = "Link doesn't appear to be the marketplace page for a discogs item";
            } else {
                try {
                    reply = await editWatchList(message, link, args.includes("delete"));
                } catch (err) {
                    reply = err.message;
                }
            }
            return message.channel.send(reply);
        },
    };
};

const shouldNotify = async (watcher: Watcher): Promise<boolean> => {
    const response = await axios.get(watcher.link);
    const $ = cheerio.load(response.data);
    const marketplaceTable = $(".mpitems").find("tbody");
    return marketplaceTable.children().length > 0;
};

const notify = async (client: Client, watcher: Watcher) => {
    const guild: Guild = await client.guilds.fetch(watcher.guild);
    const member: GuildMember = await guild.members.fetch(watcher.user);
    return member.user.send(`Available for purchase! ${watcher.link}`);
};

const notifyWatcher = (client: Client) => async (watcher) => {
    if (await shouldNotify(watcher)) {
        return notify(client, watcher);
    }
};

const notifyWatchers = (client: Client) => async () => {
    const watchers = await database.listWatchers();
    const procedures = watchers.map(notifyWatcher(client));
    return Promise.all(procedures);
};

const editWatchList = async (message: Message, link: string, deletion: boolean): Promise<string> => {
    let reply;
    const watcher: Watcher = {
        link,
        guild: getGuild(message),
        user: getUser(message),
    };
    if (deletion) {
        await database.removeWatcher(watcher);
        reply = "Removed from your watch list";
    } else {
        await database.addWatcher(watcher);
        reply = "Added to your watch list";
    }
    return reply;
};

export default watch;
