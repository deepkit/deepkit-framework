import { CommunityMessage } from '@app/common/models';
import { AppConfig } from '@app/server/config';

export class Url {
    constructor(protected baseUrl: AppConfig['baseUrl']) {}

    getCommunityQuestionUrl(communityMessage: CommunityMessage): string {
        const id = communityMessage.thread ? communityMessage.thread.id : communityMessage.id;
        return this.baseUrl + `/documentation/questions/post/${id}#answer-${communityMessage.id}`;
    }
}
