import * as dotenv from 'dotenv';
dotenv.config();
import Log from "./Log";

export enum ConfigKey {
    botToken = "botToken",
}

const config: {[key: string]: number | string | boolean} = {
    [ConfigKey.botToken]:        process.env.BOT_TOKEN,
};

export const getConfig = (key: ConfigKey): number | string | boolean => {
    if (config[key] !== null && config[key] !== undefined) {
        return config[key];
    } else {
        Log.warn(`Config Key "${key}" was not set, yet accessed.`);
        return null;
    }
};
