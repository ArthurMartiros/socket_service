import { broker } from "../../../CommonJS/src/base/base.model";
import { CommunicationCodes } from "../../../CommonJS/src/messaging/CommunicationCodes";
import { QueueType } from "../../../CommonJS/src/messaging/QueueType";
import { IUser } from "../../../CoreService/src/components/users/interfaces/user.interface";

export class GetRoutesController {
    public static async categories(filter, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.GET_CATEGORIES, filter, QueueType.CACHE_SERVICE, ip, user);
    }

    public static async markets(filter, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.GET_MARKETS, filter, QueueType.CACHE_SERVICE, ip, user);
    }

    public static async events(filter, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.GET_EVENTS, filter, QueueType.CACHE_SERVICE, ip, user);
    }

    public static async liveEvents(filter, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.GET_LIVE_EVENTS, filter, QueueType.CACHE_SERVICE, ip, user);
    }

    public static async liveTopEvents(filter, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.GET_TOP_LIVES, filter, QueueType.CACHE_SERVICE, ip, user);
    }

    public static async eventMarkets(filter, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.GET_EVENT_MARKETS, filter, QueueType.CACHE_SERVICE, ip, user);
    }

    public static async eventsMarkets(filter, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.GET_EVENTS_MARKETS, filter, QueueType.CACHE_SERVICE, ip, user);
    }

    public static async betslipDetails(filter, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.GET_BET_SLIP_DETAILS, filter, QueueType.CACHE_SERVICE, ip, user);
    }

    public static async betslips(filter, ip?: string, user?: IUser) {
        if (!user) return [];
        return broker.sendRequest(CommunicationCodes.GET_BET_SLIPS, { user_id: user.id, lang_id: filter.lang_id }, QueueType.BETSLIP_SERVICE, ip, user);
    }

    public static async getMatchOfTheDay(filter, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.GET_MATCH_OF_THE_DAY, filter, QueueType.CACHE_SERVICE, ip, user);
    }

    public static async getSpecialOffer(filter, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.GET_SPECIAL_OFFERS, filter, QueueType.CACHE_SERVICE, ip, user);
    }

    public static async getUpcomingEvents(filter, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.GET_UPCOMING_EVENTS, filter, QueueType.CACHE_SERVICE, ip, user);
    }

    public static async getEventSelections(filter, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.GET_EVENT_SELECTIONS, filter, QueueType.EVENT_SERVICE, ip, user);
    }
}
