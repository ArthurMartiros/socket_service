import { IWatcher } from "../interfaces/watcher.interface";
import { socket, Socket } from "zeromq";
import { IObserver } from "../interfaces/observer.interface";

export class ZMQWatcher implements IWatcher {
    private subscriber: Socket;
    private channelHandler: { [key: string]: IObserver[] } = {};
    private baseChannels: { [key: string]: IObserver[] } = {};

    constructor() {
        this.subscriber = socket('sub');
        this.subscriber.bind('tcp://127.0.0.1:3111');
        this.subscriber.on(`message`, (channel, message) => {
            console.log(channel, message);
            // const messageData = message.toJSON();
            // const channelData = channel.toString();
            // let observers: IObserver[];

            // if (messageData.actionType === ActionType.CREATE) {
            //     if (channelData.lang === SubjectType.BET) {
            //         observers = this.baseChannels[`new_bet`];
            //     } else {
            //         observers = this.baseChannels[`new_model`];
            //     }
            // } else {
            //     observers = this.channelHandler[channel.toString()];
            // }
            // if (observers) observers.map(h => h.invalidate(channelData, messageData));
        });
    }

    subscribe(channel: string, observer: IObserver) {
        if (!this.channelHandler[channel]) this.channelHandler[channel] = [];
        if (this.channelHandler[channel].findIndex(ob => ob.id === observer.id) == -1) this.channelHandler[channel].push(observer);
        this.subscriber.subscribe(channel);
    }

    unsubscribe(channel: string, observer: IObserver) {
        if (!this.channelHandler[channel]) this.channelHandler[channel] = [];
        const index = this.channelHandler[channel].findIndex(ob => ob.id === observer.id);
        this.channelHandler[channel].splice(index, 1);
        if (!this.channelHandler[channel].length) this.subscriber.unsubscribe(channel);
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