import { CommunicationCodes } from '../../../../CommonJS/src/messaging/CommunicationCodes';
import { SubjectType } from '../enums/subject_type.enum';

export interface IRequest {
    code: CommunicationCodes;
    token?: string;
    body: any;
}

export interface IResponse extends IRequest {
    isSuccess: boolean;
    error?: string;
    totalCount?: number;
}

export interface ISubscribeRequest {
    subjectType: SubjectType;
    ids: number[];
}