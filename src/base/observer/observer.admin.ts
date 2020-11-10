import { SubjectType } from '../enums/subject_type.enum';
import { ObserverBase } from './observer.base';
import { ActionType, IChannelData } from '../interfaces/observer.interface';

export class ObserverAdmin extends ObserverBase {
    public get baseSubscriptions(): SubjectType[] {
        return [
            SubjectType.BET,
            SubjectType.DEPOSIT,
            SubjectType.WITHDRAWAL,
            SubjectType.CASINO,
            SubjectType.UPLOADED_DOCUMENT,
            SubjectType.UPDATE_WINNERS,
            SubjectType.MESSAGE,
            SubjectType.REQUEST,
            SubjectType.UPDATE_BONUS_RECEIVERS
        ];
    }

    public create(channelDetail: IChannelData, data): void {
        switch (channelDetail.type) {
            case SubjectType.EVENT:
                return this.invalidateEvent(data);
            case SubjectType.EVENT_MARKET:
                return this.invalidateEventMarket(data);
            case SubjectType.EVENT_SELECTION:
                return this.invalidateEventSelection(data);
            case SubjectType.MARKET:
                return this.invalidateMarket(data);
            case SubjectType.CATEGORY:
                return this.invalidateCategory(data);
            case SubjectType.BET:
            case SubjectType.DEPOSIT:
            case SubjectType.WITHDRAWAL:
            case SubjectType.CASINO:
            case SubjectType.UPLOADED_DOCUMENT:
            case SubjectType.MESSAGE:
            case SubjectType.REQUEST:
                return this.invalidateNew(data, channelDetail.type);
            default:
                return;
        }
    }

    private invalidateNew(data, type: SubjectType): void {
        this.socketEmit(ActionType.CREATE, {
            type,
            data
        });
    }
}
