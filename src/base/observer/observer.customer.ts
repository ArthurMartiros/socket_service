import { toNumber } from "lodash";
import { SubjectType } from "../enums/subject_type.enum";
import { ObserverBase } from "./observer.base";
import { IChannelData, ActionType, ISocket, IRedisWatcherMessage } from "../interfaces/observer.interface";
import { IUser } from "../../../../CoreService/src/components/users/interfaces/user.interface";
import { isUndefined } from "util";
import { IWatcher } from "../interfaces/watcher.interface";

export class ObserverCustomer extends ObserverBase {
    constructor(socket: ISocket, watcher: IWatcher, user?: IUser) {
        super(socket, watcher, user);
        this.subscribe(SubjectType.UPCOMING_EVENTS, [0]);
        this.subscribe(SubjectType.TODAY_SPECIAL_OFFER, [0]);
        this.subscribe(SubjectType.MATCH_OF_THE_DAY, [0]);
        this.subscribe(SubjectType.MARKET, [0]);
        this.subscribe(SubjectType.LIVE_EVENT_LIST_CHANGE, [0]);
    }
    public get user() {
        return this._user;
    }
    public set user(data: IUser | undefined) {
        if (isUndefined(data)) {
            if (!isUndefined(this._user)) {
                this.unSubscribeToUserUpdate(toNumber(this._user.id));
            }
        } else {
            this.subscribeToUserUpdate(toNumber(data.id));
        }
        this._user = data;
    }

    public get baseSubscriptions(): SubjectType[] {
        return [
            SubjectType.CATEGORY,
            // SubjectType.MARKET,
            // SubjectType.MATCH_OF_THE_DAY,
            // SubjectType.TODAY_SPECIAL_OFFER,
            SubjectType.UPDATE_WINNERS,
            SubjectType.MESSAGE,
            SubjectType.REQUEST,
            // SubjectType.UPCOMING_EVENTS,
            //SubjectType.LIVE_EVENT_LIST_CHANGE
            SubjectType.UPDATE_BONUS_RECEIVERS
        ];
    }

    public create(channelDetail: IChannelData, data): void {
        switch (channelDetail.type) {
            case SubjectType.EVENT:
                if (!this.checkChannel(channelDetail)) return;
                return this.invalidateEvent(data);
            case SubjectType.EVENT_MARKET:
                if (!this.checkChannel(channelDetail)) return;
                return this.invalidateEventMarket(data);
            case SubjectType.EVENT_SELECTION:
                if (!this.checkChannel(channelDetail)) return;
                return this.invalidateEventSelection(data);
            case SubjectType.MARKET:
                if (!this.checkChannel(channelDetail)) return;
                return this.invalidateMarket(data);
            case SubjectType.CATEGORY:
                if (!this.checkChannel(channelDetail)) return;
                return this.invalidateCategory(data);
            case SubjectType.MESSAGE:
            case SubjectType.REQUEST:
            case SubjectType.UPCOMING_EVENTS:
            case SubjectType.LIVE_EVENT_LIST_CHANGE:
                return this.invalidateMessage(data, channelDetail.type);
            default:
                return;
        }
    }

    public update(channelDetail: IChannelData, message: IRedisWatcherMessage): void {
        switch (channelDetail.type) {
            case SubjectType.MARKET:
                if (!this.checkChannel(channelDetail)) return;
                return this.invalidateMarket(message.actionData, message.actionType);
            default:
                return super.update(channelDetail, message);
        }
    }

    private checkChannel(channelDetail: IChannelData) {
        if (toNumber(channelDetail.website) !== this.io.website_id) return;
        if (toNumber(channelDetail.channel) !== this.io.channel_id) return;
        if (toNumber(channelDetail.lang) !== this.io.lang_id) return;
        return true;
    }

    private subscribeToUserUpdate(user_id: number) {
        if (!this.subscriptions[SubjectType.USER]) this.subscriptions[SubjectType.USER] = [user_id];
        this.watcher.subscribe(
            JSON.stringify({
                type: SubjectType.USER,
                id: user_id
            }),
            this
        );
    }

    private unSubscribeToUserUpdate(user_id?: number) {
        this.subscriptions[SubjectType.USER] = [];
        this.watcher.unsubscribe(
            JSON.stringify({
                type: SubjectType.USER,
                id: user_id
            }),
            this
        );
    }

    protected unsubscribeBase(): void {
        super.unsubscribeBase();
        if (!isUndefined(this.user)) {
            this.unSubscribeToUserUpdate(toNumber(this.user.id));
        }
    }

    public invalidateMessage(data, type: SubjectType): void {
        this.socketEmit(ActionType.CREATE, {
            type,
            data
        });
    }
}
