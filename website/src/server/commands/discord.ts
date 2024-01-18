import { AnyThreadChannel, ChannelType, Client, EmbedBuilder, GatewayIntentBits, Message } from 'discord.js';
import { Questions } from "@app/server/questions";
import { AppConfig } from "@app/server/config";
import { Logger } from "@deepkit/logger";
import { CommunityMessage } from "@app/common/models";
import { Database } from "@deepkit/orm";

export async function registerBot(
    event: any,
    token: AppConfig['discordToken'],
    questions: Questions,
    logger: Logger,
    database: Database,
    client: Client,
) {
    logger = logger.scoped('Discord');
    if (!token) return;

    logger.log('Discord bot starting');
    await client.login(token);
    let botUserId = '';

    client.on('error', (error) => {
        logger.error('Discord error', error);
    });

    client.on('ready', () => {
        botUserId = client.user!.id;
        logger.log(`Discord logged in as ${client.user!.tag} ${client.user!.id}!`);
    });

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('upvote_answer:')) {
                const id = Number(interaction.customId.split(':')[1]);
                const message = await questions.vote(id, interaction.user.id, 1);
                const updatedEmbed = new EmbedBuilder().setDescription(`Votes: ${message.votes}`);
                await interaction.message.edit({ embeds: [updatedEmbed] });
            }
            if (interaction.customId.startsWith('downvote_answer:')) {
                const id = Number(interaction.customId.split(':')[1]);
                const message = await questions.vote(id, interaction.user.id, -1);
                const updatedEmbed = new EmbedBuilder().setDescription(`Votes: ${message.votes}`);
                await interaction.message.edit({ embeds: [updatedEmbed] });
            }
            await interaction.reply({ content: 'Your vote has been counted!', ephemeral: true });
        }
    });

    async function getPrompt(message: Message<boolean>): Promise<string> {
        let prompt = message.content.trim();

        if (message.reference && message.reference.messageId) {
            const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
            if (referencedMessage.author.id !== botUserId) {
                prompt = `
Here is a referenced message from @${message.author.displayName}:

${referencedMessage.content}

---

${prompt}
`;
            }
        }

        //replace all <@number> with @username
        prompt = prompt.replace(/<@(\d+)>/g, (match, id) => {
            const user = message.guild?.members.cache.get(id);
            if (user) return '@' + user.displayName;
            return match;
        });


        return prompt;
    }

    client.on('messageUpdate', async (message) => {
        if (message.author?.id === botUserId) return;

        const threadMessage = await database.query(CommunityMessage)
            .filter({ discordMessageId: message.id })
            .findOneOrUndefined();
        if (!threadMessage) return;

        if (message.partial) {
            message = await message.fetch();
        }

        threadMessage.content = await getPrompt(message);
        await database.persist(threadMessage);
    });

    client.on('threadDelete', async (thread) => {
        logger.log('threadDelete', thread.id);
        // this removes all answers as well if it's the root message (the thread beginning)
        await database.query(CommunityMessage)
            .filter({ discordThreadId: thread.id })
            .deleteMany();
    });


    client.on('messageDelete', async (message) => {
        logger.log('messageDelete', message.id);
        // this removes all answers as well if it's the root message (the thread beginning)
        await database.query(CommunityMessage)
            .filter({ discordMessageId: message.id })
            .deleteOne();
    });

    client.on('messageCreate', async (message) => {
        if (!botUserId) return;
        if (message.author?.id === botUserId) return;

        logger.log('Got message from discord', message.author.displayName, message.id, message.content);

        if (message.partial) {
            try {
                message = await message.fetch();
            } catch (error) {
                logger.error('Could not fetch partial message', error);
                return;
            }
        }

        const mentioned = message.mentions.users.has(botUserId);
        if (message.author.id === botUserId) return;

        let thread: AnyThreadChannel | undefined = undefined;
        if (message.channel.type === ChannelType.GuildPublicThread || message.channel.type === ChannelType.GuildPrivateThread) {
            thread = message.channel;
        }

        let shouldAnswer = false;

        // if (thread && thread.ownerId === botUserId) {
        //     shouldAnswer = true;
        // }

        if (mentioned) {
            //for the moment we only answer when bot is mentioned
            shouldAnswer = true;
        }

        // logger.log('discord message', channelName, { mentioned, shouldAnswer }, message);
        if (!shouldAnswer) return;

        const prompt = await getPrompt(message);

        const communityMessage = new CommunityMessage(message.author.id, message.author.displayName, prompt);
        communityMessage.discordUserAvatarUrl = message.author.avatarURL() || '';
        communityMessage.discordUrl = message.url;
        communityMessage.discordMessageId = message.id;
        if (message.channel.type === ChannelType.GuildText) {
            communityMessage.discordChannelId = message.channel.id;
        }

        if (thread) {
            communityMessage.discordThreadId = thread.id;
            const threadMessage = await database.query(CommunityMessage).filter({ discordThreadId: thread.id, thread: undefined }).findOneOrUndefined();
            // if (!threadMessage) {
            //     logger.error('Could not find parent message for thread', thread.id);
            //     await message.reply('Sorry, I could not process your message. Please try again later.');
            //     return;
            // }
            communityMessage.thread = threadMessage;

            //check if the author of the new message has role Contributor or is the owner of this thread
            if (message.author.id !== thread.ownerId) {
                const member = await thread.guild.members.fetch(message.author.id);
                const isContributor = member.roles.cache.find(v => v.name === 'Contributor');
                if (!isContributor) {
                    await message.reply('Sorry, you are not allowed to post in this thread.');
                    return;
                }
            }
        }

        let referenceMessage: CommunityMessage | undefined = undefined;
        if (message.reference) {
            referenceMessage = await database.query(CommunityMessage).filter({ discordMessageId: message.reference.messageId }).findOneOrUndefined();
            if (referenceMessage && !referenceMessage.assistant) {
                referenceMessage = undefined;
            }
            logger.log('message.reference', message.reference, referenceMessage?.id)
        }

        try {
            const response = await questions.ask(communityMessage, referenceMessage);
            if (response.type === 'edit') {
                await message.react('✅');
            }
        } catch (error) {
            logger.error('Could not process message', error);
            await message.reply('Sorry, I could not process your message. Please try again later. ' + String(error));
        }
    });

}
