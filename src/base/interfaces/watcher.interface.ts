import { IObserver } from "./observer.interface";

export interface IWatcher {
    subscribe(channel: string, observer: IObserver): void;
    unsubscribe(channel: string, observer: IObserver): void;
    subscribeToBase(observer: IObserver, channels?: string[]): void;
    unsubscribeFromBase(observer: IObserver): void;
}