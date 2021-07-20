import {Listener} from "../Listener";
import {Client, GuildMember, VoiceState} from "discord.js";
import Log from "../../util/Log";
import SettingsController from "../../controllers/SettingsController";
import {MuteOption} from "../../Types";

const unmutedListener: Listener<"voiceStateUpdate"> = {
    name: "unmutedListener",
    event: "voiceStateUpdate",
    procedure: (client: Client) => async (_: VoiceState, newVoiceState: VoiceState) => {
        if (newVoiceState.channel) {
            const guild = newVoiceState.guild.id;
            const {option} = await SettingsController.getMute(guild);
            const bot = await SettingsController.getBot(guild);
            if (newVoiceState.id === bot) {
                const futureMutes = newVoiceState.channel.members
                    .filter(shouldMute(bot))
                    .map((member) => strategies[option](client, member.voice));
                return Promise.all(futureMutes);
            } else if (shouldMute(bot)(newVoiceState.member)) {
                if (newVoiceState.channel.members.has(bot)) {
                    await strategies[option](client, newVoiceState);
                }
            }
        }
    },
};

type MuteStrategy = (client: Client, voiceState: VoiceState, message?: string) => void;

const performMute = async (client: Client, voiceState: VoiceState): Promise<void> => {
    try {
        await voiceState.setMute(true);
    } catch (err) {
        Log.error("Couldn't mute:", voiceState.member.displayName);
        await performWarn(client, voiceState, ", I'm not able to mute you!");
    }
};

const performWarn = async (client: Client, voiceState: VoiceState, message = ", you're not muted!"): Promise<void> => {
    const {channel} = await SettingsController.getMute(voiceState.guild.id);
    const warningChannel = await client.channels.fetch(channel);
    if (warningChannel.isText()) {
        await warningChannel.send(`${voiceState.member.user.toString()}${message}`);
    }
};

const performNothing = (_: Client, voiceState: VoiceState) => Log.debug(`Not muting ${voiceState.member.displayName}`);

const shouldMute = (botID: string) => (member: GuildMember): boolean =>
    member.id !== botID && member.voice.mute === false && member.hasPermission('SPEAK');

const strategies: {[strategy: string]: MuteStrategy} = {
    [MuteOption.ON]: performMute,
    [MuteOption.WARN]: performWarn,
    [MuteOption.OFF]: performNothing,
};

module.exports = unmutedListener;
