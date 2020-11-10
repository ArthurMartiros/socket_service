import { IRequest, IResponse, ISubscribeRequest } from "../interfaces/request.interface";
import { CommunicationCodes } from "../../../../CommonJS/src/messaging/CommunicationCodes";
import { GetRoutesController } from "../../controllers/get.controller";
import { IObserver } from "../interfaces/observer.interface";
import { PostRoutesController } from "../../controllers/post.controller";
import { toNumber, isArray, isNil } from "lodash";
import { isNotNumber } from "../../../../CommonJS/src/utils/validators";
import { ErrorCodes } from "../../../../CommonJS/src/messaging/ErrorCodes";
import { Events } from "../enums/events.enum";
import { User } from "../../../../CoreService/src/components/users/models/user.model";
import { isUndefined } from "util";

export class ObserverController {
    private observer: IObserver;

    constructor(observer: IObserver) {
        this.observer = observer;
    }

    public subscribe(): void {
        this.observer.socket.on(Events.GET, async (req: IRequest, response: Function) => {
            const resp: IResponse = {
                code: req.code,
                isSuccess: false,
                body: `unknown CommunicationCodes ${req.code}`
            };
            switch (req.code) {
                case CommunicationCodes.GET_CATEGORIES:
                    return response(await this.prepareResp(GetRoutesController.categories, req));
                case CommunicationCodes.GET_MARKETS:
                    //return sport default markets if not specified
                    req.body.sport_default = isUndefined(req.body.sport_default) ? true : req.body.sport_default;
                    return response(await this.prepareResp(GetRoutesController.markets, req));
                case CommunicationCodes.GET_EVENTS:
                    return response(await this.prepareResp(GetRoutesController.events, req));
                case CommunicationCodes.GET_LIVE_EVENTS:
                    return response(await this.prepareResp(GetRoutesController.liveEvents, req));
                case CommunicationCodes.GET_TOP_LIVES:
                    return response(await this.prepareResp(GetRoutesController.liveTopEvents, req));
                case CommunicationCodes.GET_EVENT_MARKETS:
                    return response(await this.prepareResp(GetRoutesController.eventMarkets, req));
                case CommunicationCodes.GET_EVENTS_MARKETS:
                    return response(await this.prepareResp(GetRoutesController.eventsMarkets, req));
                case CommunicationCodes.GET_BET_SLIP_DETAILS:
                    return response(await this.prepareResp(GetRoutesController.betslipDetails, req));
                case CommunicationCodes.GET_BET_SLIPS:
                    return response(await this.prepareResp(GetRoutesController.betslips, req));
                case CommunicationCodes.GET_SPECIAL_OFFERS:
                    return response(await this.prepareResp(GetRoutesController.getSpecialOffer, req));
                case CommunicationCodes.GET_UPCOMING_EVENTS:
                    return response(await this.prepareResp(GetRoutesController.getUpcomingEvents, req));
                case CommunicationCodes.GET_MATCH_OF_THE_DAY:
                    return response(await this.prepareResp(GetRoutesController.getMatchOfTheDay, req));
                case CommunicationCodes.GET_EVENT_SELECTIONS:
                    return response(await this.prepareResp(GetRoutesController.getEventSelections, req));
                default:
                    return response(resp);
            }
        });

        this.observer.socket.on(Events.POST, async (req: IRequest, response: Function) => {
            const resp: IResponse = {
                code: req.code,
                isSuccess: false,
                body: `unknown CommunicationCodes ${req.code}`
            };
            switch (req.code) {
                case CommunicationCodes.PLACE_BET:
                    if (isNil(this.observer.user)) return response(this.unauthorizedResponse(req));
                    Object.assign(req.body, { user: this.observer.user, ip: this.observer.ip });
                    return response(await this.prepareResp(PostRoutesController.placeBet, req));
                case CommunicationCodes.BET_REVIEW_UPDATE:
                    if (!this.observer.user || !User.isAdmin(this.observer.user)) {
                        return response(this.unauthorizedResponse(req));
                    }
                    return response(await this.prepareResp(PostRoutesController.betReviewUpdate, req));
                default:
                    return response(resp);
            }
        });

        this.observer.socket.on(Events.SUBSCRIBE, async (req: ISubscribeRequest, response: Function) => {
            if (!req.subjectType) return;
            this.observer.subscribe(req.subjectType, req.ids);
            return response({ isSuccess: true });
        });
        this.observer.socket.on(Events.UNSUBSCRIBE, async (req: ISubscribeRequest) => {
            this.observer.unsubscribe(req.subjectType, req.ids);
        });
        this.observer.socket.on(Events.CHANGE_LANG_ID, async (req, response: Function) => {
            this.observer.lang_id = req.langId;
            return response({ isSuccess: true });
        });
    }

    public destroy() {
        this.observer.socket.removeAllListeners();
        delete this.observer;
    }

    private unauthorizedResponse(req: IRequest): IResponse {
        return {
            code: req.code,
            isSuccess: false,
            error: ErrorCodes.UNAUTHORIZED.toString(),
            body: `ErrorCodes.UNAUTHORIZED`
        };
    }

    private async prepareResp(method: Function, req: IRequest): Promise<IResponse> {
        const resp: IResponse = {
            code: req.code,
            isSuccess: false,
            body: undefined,
            error: ""
        };
        try {
            const data = await method(Object.assign(req.body, this.observer.channelSettings), this.observer.ip, this.observer.user);
            if (data && data.hasOwnProperty(`full_count`) && data.hasOwnProperty(`data`) && isArray(data.data)) {
                resp.totalCount = data.full_count;
                resp.body = data.data;
            } else resp.body = data;
            resp.isSuccess = true;
        } catch (e) {
            const errorCode = toNumber(e);
            if (!isNotNumber(errorCode)) resp.error = ErrorCodes[errorCode];
            resp.body = e;
        }
        return resp;
    }
}
