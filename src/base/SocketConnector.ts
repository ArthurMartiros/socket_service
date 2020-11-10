import { Server } from "socket.io";
import { IWatcher } from "./interfaces/watcher.interface";
import { RedisWatcher } from "./watchers/redis.watcher";
import { IObserver, ISocket } from "./interfaces/observer.interface";
import { ObserverCustomer } from "./observer/observer.customer";
import { ObserverAdmin } from "./observer/observer.admin";
import * as jwt from "jsonwebtoken";
import { Inflate } from "../../../API/src/utils/crypto.utils";
import { CommunicationCodes } from "../../../CommonJS/src/messaging/CommunicationCodes";
import { broker } from "../../../CommonJS/src/base/base.model";
import { QueueType } from "../../../CommonJS/src/messaging/QueueType";
import { User } from "../../../CoreService/src/components/users/models/user.model";
import { IUser } from "../../../CoreService/src/components/users/interfaces/user.interface";
import { isRealString } from "../../../CommonJS/src/utils/validators";
import { IResponse } from "./interfaces/request.interface";
import { isUndefined } from "util";
import { map } from "bluebird";
import { Events } from "./enums/events.enum";
import { ObserverBase, setChannelSettings } from "./observer/observer.base";
import { isNil, groupBy, mapValues } from "lodash";
import { ChannelType } from "../../../CommonJS/src/enums/channel_type.enum";

export class SocketConnector {
    private observers: { [key: string]: IObserver } = {};
    private watcher: IWatcher;
    private socketServer: Server;

    constructor(io: Server) {
        io.on("connection", async (observer: ISocket) => await this.onConnect(observer));
        // create watcher
        this.watcher = new RedisWatcher();
        this.socketServer = io;
    }

    private groupByMany(collection, keys: string[]) {
        if (!keys.length) {
            return collection;
        } else {
            const cont = this;
            return mapValues(groupBy(collection, keys[0]), function(values) {
                return cont.groupByMany(values, keys.slice(1));
            });
        }
    }
    public get io(): Server {
        return this.socketServer;
    }

    private async onConnect(socket: ISocket): Promise<void> {
        // set website_id, lang_id, channel_id
        await setChannelSettings(socket);
        // save subscription
        const observer = await this.createObserver(socket, this.watcher);

        if (!isNil(observer.user)) await this.changeUserOnlineStatus(observer, true);
        observer.socket.on(Events.CHANGE_TOKEN, async (req, response) => response(await this.onChangeToken(observer, req.token)));
        observer.socket.on(Events.DISCONNECT, async () => {
            if (!isUndefined(observer.user)) {
                this.onDisconnect(observer.socket);
                await this.changeUserOnlineStatus(observer, false);
            } else {
                this.onDisconnect(observer.socket);
            }
        });
        if (!isUndefined(observer.user)) await this.changeUserOnlineStatus(observer, true);
        this.observers[observer.id] = observer;
    }

    private async createObserver(socket: ISocket, watcher: IWatcher): Promise<IObserver> {
        const user = await decodeUser(socket.handshake.query.token);
        let observer: ObserverAdmin | ObserverCustomer;
        if (!isNil(user) && User.isAdmin(user) && socket.channel_id === ChannelType.BACKEND) {
            observer = new ObserverAdmin(socket, watcher, user);
        } else {
            observer = new ObserverCustomer(socket, watcher, user);
        }
        observer.socket.on(Events.LOGOUT, () => this.onLogout(observer));
        observer.setConnectionInfo(socket.handshake.query);
        return observer;
    }

    private async onLogout(currentObserver: ObserverBase) {
        if (!currentObserver.user) return;

        Object.values(this.observers)
            .filter(observer => {
                const observerUserId = observer && observer.user ? observer.user.id : undefined;
                const currentObserverUserId = currentObserver && currentObserver.user ? currentObserver.user.id : undefined;
                return observerUserId && currentObserverUserId && observerUserId === currentObserverUserId;
            })
            .forEach(observer => this.io.to(observer.id).emit(Events.LOGOUT, {}));
    }

    private async onChangeToken(observer: IObserver, token?: string): Promise<IResponse> {
        const user = await decodeUser(token);
        if (isUndefined(user)) {
            await this.changeUserOnlineStatus(observer, false);
            observer.user = undefined;
            observer.token = undefined;
        } else {
            observer.user = user;
            observer.token = token;
            await this.changeUserOnlineStatus(observer, true);
        }
        return {
            code: 0,
            isSuccess: true,
            body: undefined
        };
    }

    private onDisconnect(socket): void {
        const observer = this.observers[socket.id];
        if (observer) {
            observer.destroy();
            delete this.observers[observer.id];
        }
    }

    private async changeUserOnlineStatus(observer: IObserver, is_online: boolean): Promise<void> {
        if (!isUndefined(observer.user)) {
            const userWithSomeId = await this.findOtherObserverWithSomeUserId(observer.user.id, observer.id);
            if (isUndefined(userWithSomeId)) {
                broker.publishMessageWithCode(
                    CommunicationCodes.CHANGE_USER_ONLINE_STATUS,
                    {
                        id: observer.user.id,
                        is_online,
                        ip: observer.ip
                    },
                    QueueType.CORE_SERVICE
                );
            }
        }
    }

    private async findOtherObserverWithSomeUserId(user_id: number, observer_id: string): Promise<IUser | undefined> {
        let user: IUser | undefined = undefined;
        await map(Object.values(this.observers), observer => {
            if (!isUndefined(observer.user)) {
                if (observer.user.id === user_id && observer.id !== observer_id) user = observer.user;
            }
        });
        return user;
    }
}

export async function decodeUser(token?: string): Promise<IUser | undefined> {
    if (!isRealString(token, 2)) return;
    const decoded = jwt.decode(token, { complete: true }) as { [key: string]: any };
    if (!decoded) return;
    try {
        const json = await Inflate(decoded.payload.data);
        const data = JSON.parse(json);
        return broker.sendRequest<IUser | undefined>(CommunicationCodes.GET_USER, { id: data.user_id }, QueueType.CORE_SERVICE);
    } catch (e) {
        return;
    }
}
