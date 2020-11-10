import { SubjectType } from "../enums/subject_type.enum";
import { Socket } from 'socket.io';
import { ChannelType } from '../../../../CommonJS/src/enums/channel_type.enum';
import { IUser } from "../../../../CoreService/src/components/users/interfaces/user.interface";

export interface ISocket extends Socket {
    lang_id: number;
    website_id: number | null;
    channel_id: ChannelType;
}

export interface IObserver {
    id: string;
    user?: IUser;
    token?: string;
    ip?: string;
    lang_id: number;
    connectionInfo?: IConnectionInfo;
    channelSettings: ChannelSettings;
    baseSubscriptions: SubjectType[];
    socket: Socket;
    subscribe(type: SubjectType, ids: number[]): void;
    unsubscribe(type: SubjectType, ids: number[]): void;
    invalidate(channelDetail: IChannelData, message: IRedisWatcherMessage): void;
    create(channelDetail: IChannelData, data): void;
    update(channelDetail: IChannelData, data: IRedisWatcherMessage): void;
    subscriptions: any;
    destroy(): void;
}

export interface ChannelSettings {
    website_id: number;
    channel_id: ChannelType;
    lang_id: number;
}

export interface IRedisWatcherMessage {
    actionType: ActionType;
    actionData: any;

    actionSubjectType?: SubjectType
}

export interface IChannelData {
    website: number,
    channel: ChannelType,
    lang: number,
    type: SubjectType,
    id: number
}

export enum ActionType {
    CREATE = 1,
    UPDATE,
    DELETE
}

export interface IConnectionInfo {
    screen?: string;
    screen_width?: string;
    screen_height?: string;
    browser?: string;
    browser_version?: string;
    os?: string;
    os_version?: string;
    mobile?: string;
    cookies?: string;
    flash_version?: string;
}