import { broker } from '../../../CommonJS/src/base/base.model';
import { CommunicationCodes } from '../../../CommonJS/src/messaging/CommunicationCodes';
import { QueueType } from '../../../CommonJS/src/messaging/QueueType';
import { IUser } from '../../../CoreService/src/components/users/interfaces/user.interface';

export class PostRoutesController {
    public static async placeBet(bet, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.PLACE_BET, bet, QueueType.BETSLIP_SERVICE, ip, user);
    }

    public static async betReviewUpdate(bet, ip?: string, user?: IUser) {
        return broker.sendRequest(CommunicationCodes.BET_REVIEW_UPDATE, bet, QueueType.BETSLIP_SERVICE, ip, user);
    }
}