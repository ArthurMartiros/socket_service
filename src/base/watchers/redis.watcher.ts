import { redis } from "../../../../CacheService/src/utils/cache";
import { IWatcher } from "../interfaces/watcher.interface";
import { IChannelData, IObserver, IRedisWatcherMessage } from "../interfaces/observer.interface";
import { isNil, toNumber } from "lodash";
import { ObserverAdmin } from "../observer/observer.admin";
import { ObserverCustomer } from "../observer/observer.customer";

export class RedisWatcher implements IWatcher {
    private static subscribePattern = [
        `{"type":*,"id":*`,
        `{"event_selection_statistic":*,"type":*}`,
        `{"event_rtm_statistic":*,"type":*}`,
        `{"from":*,"to":*,"type":*}`,
        `?"website":*,"channel":*,"lang":*,"type":*,"id":*`,
        `{"type":*}`
    ];
    private channelHandler: { [key: string]: IObserver[] } = {};
    private baseChannels: { [key: number]: IObserver[] } = {};

    constructor() {
        RedisWatcher.subscribePattern.forEach(p => {
            redis.psubscribe(p);
        });
        redis.on(`pmessage`, async (_pattern: string, channel: string, message: string) => {
            const messageData: IRedisWatcherMessage = JSON.parse(message);
            const channelData: IChannelData = JSON.parse(channel);
            let observers: IObserver[];
            if (_pattern === `{"from":*,"to":*,"type":*}`) {
                const ch = JSON.parse(channel) as { from: number; to?: number };
                observers = this.baseChannels[channelData.type];
                if (!ch.to) {
                    const admins = observers.filter(o => o instanceof ObserverAdmin);
                    admins.forEach(h => h.invalidate(channelData, messageData));
                } else {
                    const receivers = observers.filter(o => !isNil(o.user) && toNumber(o.user.id) === ch.to && o instanceof ObserverCustomer);
                    if (receivers) receivers.forEach(r => r.invalidate(channelData, messageData));
                }
            } else {
                observers = this.baseChannels[channelData.type] || this.channelHandler[channel];
                if (observers && observers.length) {
                    observers.forEach(h => {
                        if (messageData.actionSubjectType) {
                            channelData.type = messageData.actionSubjectType;
                        }
                        h.invalidate(channelData, messageData);
                    });
                }
            }
        });
    }

    public subscribe(channel: string, observer: IObserver): void {
        if (!this.channelHandler[channel]) this.channelHandler[channel] = [];
        if (this.channelHandler[channel].findIndex(ob => ob.id === observer.id) == -1) this.channelHandler[channel].push(observer);
        // redis.subscribe(channel);
    }

    public unsubscribe(channel: string, observer: IObserver): void {
        if (!this.channelHandler[channel]) this.channelHandler[channel] = [];
        const index = this.channelHandler[channel].findIndex(ob => ob.id === observer.id);
        if (index >= 0) this.channelHandler[channel].splice(index, 1);
        // if (!this.channelHandler[channel].length) redis.unsubscribe(channel);
    }

    public subscribeToBase(observer: IObserver): void {
        for (let baseChannelsKey of observer.baseSubscriptions) {
            if (!this.baseChannels[baseChannelsKey]) this.baseChannels[baseChannelsKey] = [];
            this.baseChannels[baseChannelsKey].push(observer);
        }
        // redis.subscribe(Object.keys(this.baseChannels));
    }

    public unsubscribeFromBase(observer: IObserver): void {
        for (let baseChannelsKey of observer.baseSubscriptions) {
            if (!this.baseChannels[baseChannelsKey]) this.baseChannels[baseChannelsKey] = [];
            const index = this.baseChannels[baseChannelsKey].findIndex(ob => ob.id === observer.id);
            if (index >= 0) this.baseChannels[baseChannelsKey].splice(index, 1);
        }
    }
}
