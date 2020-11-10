import { ActionType, IChannelData, IObserver, IRedisWatcherMessage, IConnectionInfo, ISocket } from "../interfaces/observer.interface";
import { IWatcher } from "../interfaces/watcher.interface";
import { ChannelType } from "../../../../CommonJS/src/enums/channel_type.enum";
import { ObserverController } from "./observer.controller";
import { DEFAULT_LANGUAGE, DEFAULT_WEB_SITE } from "../../../../CommonJS/src/domain/constant";
import { SubjectType } from "../enums/subject_type.enum";
import { CategoryType } from "../../../../CategoryService/src/components/category/enums/category_type.enum";
import { IMarketModel } from "../../../../CacheService/src/components/market/interfaces/market.interface";
import { IEventMarketModel } from "../../../../CacheService/src/components/event_market/interfaces/event_market.interface";
import { IEventModel } from "../../../../CacheService/src/components/event/interfaces/event.interface";
import { ICategory } from "../../../../CacheService/src/components/category/interfaces/category.interface";
import { Socket } from "socket.io";
import { intersectionWith, toNumber, uniq, isNil } from "lodash";
import { isUndefined } from "util";
import { IUser } from "../../../../CoreService/src/components/users/interfaces/user.interface";
import { Events } from "../enums/events.enum";
import { broker } from "../../../../CommonJS/src/base/base.model";
import { IWebsiteModel } from "../../../../CoreService/src/components/website/interfaces/website.interface";
import { CommunicationCodes } from "../../../../CommonJS/src/messaging/CommunicationCodes";
import { QueueType } from "../../../../CommonJS/src/messaging/QueueType";
import { isNotNumber } from "../../../../CommonJS/src/utils/validators";
import * as parseDomain from "parse-domain";
import { map } from "bluebird";
import { IEventSelection } from "../../../../EventService/src/components/event.selection/interfaces/event.selection.interface";

export abstract class ObserverBase implements IObserver {
    protected io: ISocket;
    protected watcher: IWatcher;
    protected controller: ObserverController;
    protected website_id: number;
    protected channel_id: ChannelType;
    protected _lang_id: number;
    public id: string;
    public subscriptions: { [key: number]: number[] } = {};
    protected _user?: IUser;
    public token?: string;
    public ip?: string;
    public connectionInfo?: IConnectionInfo;

    constructor(socket: ISocket, watcher: IWatcher, user?: IUser) {
        this.id = socket.id;
        this.io = socket;
        // get ip
        let forwaredFor: string | undefined = socket.handshake.headers[`X-Forwarded-For`] || socket.handshake.headers[`x-forwarded-for`];
        if (forwaredFor && forwaredFor.length) forwaredFor = forwaredFor.split(",")[0];
        this.ip = forwaredFor || socket.handshake.address;
        this.watcher = watcher;
        this.user = user;
        // create controller
        this.controller = new ObserverController(this);
        this.controller.subscribe();
        this.watcher.subscribeToBase(this);
    }

    public setConnectionInfo(data: IConnectionInfo) {
        if (!data) throw new Error(`data is invalid`);
        this.connectionInfo = {
            screen: data.screen,
            screen_width: data.screen_width,
            screen_height: data.screen_height,
            browser: data.browser,
            browser_version: data.browser_version,
            os: data.os,
            os_version: data.os_version,
            mobile: data.mobile,
            cookies: data.cookies,
            flash_version: data.flash_version
        };
    }

    public get user(): IUser | undefined {
        return this._user;
    }

    public set user(data: IUser | undefined) {
        this._user = data;
    }

    public get socket(): Socket {
        return this.io;
    }

    public get channelSettings() {
        return {
            website_id: this.io.website_id as number,
            channel_id: this.io.channel_id,
            lang_id: this.io.lang_id
        };
    }

    public get channelSettingsString() {
        return JSON.stringify(this.channelSettings);
    }

    public abstract get baseSubscriptions(): SubjectType[];

    public set lang_id(langId: number) {
        const newLang = toNumber(langId) || DEFAULT_LANGUAGE;
        if (newLang !== this.lang_id) {
            this.reSubscribeToNewLang(newLang);
            this._lang_id = newLang;
        }
    }

    public invalidate(channelDetail: IChannelData, message: IRedisWatcherMessage): void {
        switch (message.actionType) {
            case ActionType.CREATE:
                return this.create(channelDetail, message.actionData);
            case ActionType.UPDATE:
            case ActionType.DELETE:
                return this.update(channelDetail, message);
        }
    }

    public async subscribe(type: SubjectType, ids: number[], langId?: number): Promise<void> {
        // if subscriptions does not exits create new
        if (!this.subscriptions[type]) this.subscriptions[type] = [];
        // get old subscriptions
        const oldSubscriptions = this.subscriptions[type];
        if (oldSubscriptions.length) await this.unsubscribe(type, oldSubscriptions);
        // subscribe
        this.subscriptions[type] = uniq(ids.map(id => toNumber(id)));
        await map(this.subscriptions[type], async id => this.watcher.subscribe(this.getChannelKey(type, id, langId), this));
    }

    public async unsubscribe(type: SubjectType, ids: number[]): Promise<void> {
        // if subscriptions does not exits create new
        if (!this.subscriptions[type]) this.subscriptions[type] = [];
        if (!this.subscriptions[type].length) return;
        // get old subscriptions
        const oldSubscriptions = this.subscriptions[type];
        ids = uniq(ids);
        await map(ids, async id => {
            const index = oldSubscriptions.indexOf(id);
            if (id > 0) oldSubscriptions.splice(index, 1);
            this.watcher.unsubscribe(this.getChannelKey(type, id), this);
        });
    }

    public async destroy(): Promise<void> {
        const subscriptions = Object.keys(this.subscriptions);
        await map(subscriptions, async key => {
            if (this.subscriptions[key] && this.subscriptions[key].length) this.unsubscribe(toNumber(key), this.subscriptions[key]);
        });
        this.unsubscribeBase();
        this.controller.destroy();
        this.io.removeAllListeners();
        delete this.controller;
        delete this.watcher;
        delete this.io;
    }

    public abstract create(channelDetail: IChannelData, data): void;

    public update(channelDetail: IChannelData, message: IRedisWatcherMessage): void {
        return this.socketEmit(message.actionType, {
            type: channelDetail.type,
            data: message.actionData
        });
    }

    protected reSubscribeToNewLang(newLang: number): void {
        const keys = Object.keys(this.subscriptions);
        map(keys, async key => {
            if (this.subscriptions[key] && this.subscriptions[key].length) {
                this.subscribe(toNumber(key), this.subscriptions[key].slice(0), newLang);
            }
        });
    }

    protected getChannelKey(type: SubjectType, id: number, lang_id?: number): string {
        switch (type) {
            case SubjectType.BET:
            case SubjectType.DEPOSIT:
            case SubjectType.WITHDRAWAL:
            case SubjectType.CASINO:
            case SubjectType.EVENT_SELECTION:
                return JSON.stringify({
                    type: toNumber(type),
                    id: toNumber(id)
                });
            case SubjectType.EVENT_SELECTION_STATISTIC:
                return JSON.stringify({
                    event_selection_statistic: toNumber(id),
                    type: toNumber(type)
                });
            case SubjectType.EVENT_RTM_STATISTIC:
                return JSON.stringify({
                    event_rtm_statistic: toNumber(id),
                    type: toNumber(type)
                });
            default:
                return JSON.stringify({
                    website: this.io.website_id,
                    channel: this.io.channel_id,
                    lang: toNumber(lang_id) || this.io.lang_id,
                    type: toNumber(type),
                    id: toNumber(id)
                });
        }
    }

    protected invalidateEvent(data: IEventModel): void {
        if (this.subscriptions[SubjectType.CATEGORY] && this.subscriptions[SubjectType.CATEGORY].length > 0) {
            // check is user subscribe to event categories
            if (
                intersectionWith(
                    [toNumber(data.sport_id), toNumber(data.country_id), toNumber(data.league_id)],
                    this.subscriptions[SubjectType.CATEGORY],
                    (id1, id2) => {
                        return toNumber(id1) === toNumber(id2);
                    }
                ).length > 0
            ) {
                this.socketEmit(ActionType.CREATE, {
                    type: SubjectType.EVENT,
                    data
                });
            }
        }
    }

    protected invalidateEventMarket(data: IEventMarketModel): void {
        if (this.subscriptions[SubjectType.EVENT] && this.subscriptions[SubjectType.EVENT].length > 0) {
            // check is user subscribe to events from market event
            if (this.subscriptions[SubjectType.EVENT].includes(toNumber(data.event_id))) {
                this.socketEmit(ActionType.CREATE, {
                    type: SubjectType.EVENT_MARKET,
                    data
                });
            }
        }
    }

    protected invalidateEventSelection(data: IEventSelection): void {
        if (this.subscriptions[SubjectType.EVENT_SELECTION] && this.subscriptions[SubjectType.EVENT_SELECTION].length > 0) {
            if (this.subscriptions[SubjectType.EVENT_SELECTION].includes(toNumber(data.status_id), data.odd)) {
                this.socketEmit(ActionType.UPDATE, {
                    type: SubjectType.EVENT_SELECTION,
                    data: {
                        id: data.selection_id,
                        status_id: data.status_id,
                        odd: data.odd
                    }
                });
            }
        }
    }

    protected invalidateMarket(data: IMarketModel, actionType: ActionType = ActionType.CREATE): void {
        if (this.subscriptions[SubjectType.CATEGORY] && this.subscriptions[SubjectType.CATEGORY].length > 0) {
            // check is user subscribe to events from market event
            if (this.subscriptions[SubjectType.CATEGORY].includes(toNumber(data.category_id))) {
                this.socketEmit(actionType, {
                    type: SubjectType.MARKET,
                    data
                });
            }
        }
    }

    protected invalidateCategory(data: ICategory): void {
        if (!data.parent_id && data.type_id === CategoryType.SPORT) {
            this.socketEmit(ActionType.CREATE, {
                type: SubjectType.CATEGORY,
                data
            });
        } else {
            if (this.subscriptions[SubjectType.CATEGORY] && this.subscriptions[SubjectType.CATEGORY].length > 0) {
                // check is user subscribe to parent category or this is new sport
                if (this.subscriptions[SubjectType.CATEGORY].includes(toNumber(data.parent_id))) {
                    this.socketEmit(ActionType.CREATE, {
                        type: SubjectType.CATEGORY,
                        data
                    });
                }
            }
        }
    }

    protected socketEmit(eventType: ActionType, data): void {
        let eventName: string | undefined = undefined;
        switch (eventType) {
            case ActionType.CREATE:
                eventName = Events.CREATE;
                break;
            case ActionType.DELETE:
                eventName = Events.DELETE;
                break;
            case ActionType.UPDATE:
                eventName = Events.UPDATE;
                break;
        }
        if (!isUndefined(eventName)) {
            if (!isUndefined(this.socket)) this.socket.emit(eventName, data);
        }
    }

    protected unsubscribeBase(): void {
        this.watcher.unsubscribeFromBase(this);
    }
}

export async function setChannelSettings(io: Socket) {
    await this.setWebSiteId(io);
    await this.setChannelId(io);
    await this.setLangId(io);
    return io;
}

export async function setWebSiteId(io: ISocket): Promise<void> {
    // check website
    if (process.env.NODE_ENV === "production") {
        const domain = parseDomain(io.handshake.headers.origin);
        if (!domain || !domain.domain) return;
        const website = await broker.sendRequest<IWebsiteModel | undefined>(
            CommunicationCodes.GET_WEBSITE,
            { domain: `${domain.domain}.${domain.tld}` },
            QueueType.CORE_SERVICE
        );
        if (isNil(website) || isNotNumber(website.id)) io.website_id = null;
        else {
            io.website_id = website.id;
        }
    } else {
        io.website_id = DEFAULT_WEB_SITE;
    }
}

export function setChannelId(io: ISocket): void {
    const origin = io.handshake.headers.origin;
    const domain = parseDomain(origin);
    if ((domain && domain.subdomain.includes("admin")) || origin.includes("localhost:3000")) {
        io.channel_id = ChannelType.BACKEND;
    } else {
        this.setDeviceType(io, io.handshake.headers["user-agent"]);
    }
}

export function setLangId(io: ISocket): void {
    io.lang_id = toNumber(io.handshake.query.lang_id) || DEFAULT_LANGUAGE;
}

export function setDeviceType(io: ISocket, ua?: string): void {
    if (isUndefined(ua) || ua.length === 0) {
        io.channel_id = ChannelType.WEB;
    } else {
        const type = this.getDeviceType(ua);
        switch (type) {
            case "tablet":
                io.channel_id = ChannelType.TABLET;
                break;
            case "phone":
                io.channel_id = ChannelType.MOBILE;
                break;
            case "desktop":
            default:
                io.channel_id = ChannelType.WEB;
        }
    }
}

// this code from node-module express-device
export function getDeviceType(ua: string): string {
    if (ua.match(/iP(a|ro)d/i) || (ua.match(/tablet/i) && !ua.match(/RX-34/i)) || ua.match(/FOLIO/i)) {
        // if user agent is a Tablet
        return "tablet";
    } else if (ua.match(/Linux/i) && ua.match(/Android/i) && !ua.match(/Fennec|mobi|HTC Magic|HTCX06HT|Nexus One|SC-02B|fone 945/i)) {
        // if user agent is an Android Tablet
        return "tablet";
    } else if (
        ua.match(/Kindle/i) ||
        (ua.match(/Mac OS/i) && ua.match(/Silk/i)) ||
        (ua.match(/AppleWebKit/i) && ua.match(/Silk/i) && !ua.match(/Playstation Vita/i))
    ) {
        // if user agent is a Kindle or Kindle Fire
        return "tablet";
    } else if (
        ua.match(
            /GT-P10|SC-01C|SHW-M180S|SGH-T849|SCH-I800|SHW-M180L|SPH-P100|SGH-I987|zt180|HTC( Flyer|_Flyer)|Sprint ATP51|ViewPad7|pandigital(sprnova|nova)|Ideos S7|Dell Streak 7|Advent Vega|A101IT|A70BHT|MID7015|Next2|nook/i
        ) ||
        (ua.match(/MB511/i) && ua.match(/RUTEM/i))
    ) {
        // if user agent is a pre Android 3.0 Tablet
        return "tablet";
    } else if (ua.match(/BOLT|Fennec|Iris|Maemo|Minimo|Mobi|mowser|NetFront|Novarra|Prism|RX-34|Skyfire|Tear|XV6875|XV6975|Google Wireless Transcoder/i)) {
        // if user agent is unique phone User Agent
        return "phone";
    } else if (ua.match(/Opera/i) && ua.match(/Windows NT 5/i) && ua.match(/HTC|Xda|Mini|Vario|SAMSUNG\-GT\-i8000|SAMSUNG\-SGH\-i9/i)) {
        // if user agent is an odd Opera User Agent - http://goo.gl/nK90K
        return "phone";
    } else if ((ua.match(/Windows (NT|XP|ME|9)/) && !ua.match(/Phone/i) && !ua.match(/Bot|Spider|ia_archiver|NewsGator/i)) || ua.match(/Win( ?9|NT)/i)) {
        // if user agent is Windows Desktop
        return "desktop";
    } else if (ua.match(/Macintosh|PowerPC/i) && !ua.match(/Silk|moatbot/i)) {
        // if agent is Mac Desktop
        return "desktop";
    } else if (ua.match(/Linux/i) && ua.match(/X11/i) && !ua.match(/Charlotte|JobBot/i)) {
        // if user agent is a Linux Desktop
        return "desktop";
    } else if (ua.match(/CrOS/)) {
        // if user agent is a Chrome Book
        return "desktop";
    } else if (ua.match(/Solaris|SunOS|BSD/i)) {
        // if user agent is a Solaris, SunOS, BSD Desktop
        return "desktop";
    } else return "desktop";
}
