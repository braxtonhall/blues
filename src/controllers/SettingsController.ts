import {ConfigKey, getConfig} from "../util/Config";
import {NeDBAdapter} from "../adapters/database/NeDBAdapter";
import {MuteConfig, MuteOption, PruneOption, Setting} from "../Types";
import {isMuteConfig, isPruneOption} from "../util/Util";

const DEFAULT_PREFIX = String(getConfig(ConfigKey.defaultPrefix));
const ILLEGAL_PREFIXES = ["/", "@", "#"];

const DEFAULT_MUTE = {channel:"", option: MuteOption.OFF};

const DEFAULT_PRUNE = PruneOption.OFF;

// TODO cache is bonk lol
const settingCache = new Map<Setting, any>();

const assert = (scrutinee: boolean, reason: string) => {
    if (!scrutinee) {
        throw new Error(reason);
    }
};

const getSetting = async <T>(guild: string, setting: Setting, defaultSetting: T): Promise<T> => {
    const maybeSetting = settingCache.get(setting) ?? await NeDBAdapter.getSetting(guild, setting);
    settingCache.set(setting, maybeSetting ?? defaultSetting);
    return settingCache.get(setting);
};

const setSetting = async <T>(guild: string, setting: Setting, newValue: T): Promise<void> => {
    await NeDBAdapter.setSetting(guild, setting, newValue);
    settingCache.set(setting, newValue);
};

const getPrefix = (guild: string): Promise<string> => getSetting(guild, Setting.PREFIX, DEFAULT_PREFIX);
const setPrefix = (guild: string, newPrefix: string): Promise<void> => {
    assert(newPrefix.length === 1, "Prefix must be of length 1");
    assert(!!newPrefix, "Prefix must not be whitespace");
    assert(!/[a-zA-Z0-9]/.test(newPrefix), "Prefix should not be alphanumeric");
    assert(!ILLEGAL_PREFIXES.includes(newPrefix), `"${newPrefix}" is not a legal prefix`);
    return setSetting(guild, Setting.PREFIX, newPrefix);
};

const getMute = (guild: string): Promise<MuteConfig> => getSetting(guild, Setting.MUTE, DEFAULT_MUTE);
const setMute = (guild: string, newOption: MuteConfig): Promise<void> => {
    assert(isMuteConfig(newOption), `Mute must be set to '${MuteOption.ON}', '${MuteOption.OFF}', or '${MuteOption.WARN}'`);
    return setSetting(guild, Setting.MUTE, newOption);
};

const getPrune = (guild: string): Promise<string> => getSetting(guild, Setting.PRUNE, DEFAULT_PRUNE);
const setPrune = (guild: string, prune: string): Promise<void> => {
    assert(isPruneOption(prune), `Prune must be set to '${PruneOption.ON}' or '${PruneOption.OFF}'`);
    return setSetting(guild, Setting.PRUNE, prune);
};

export default {
    setPrefix,
    getPrefix,
    setMute,
    getMute,
    getPrune,
    setPrune,
};
