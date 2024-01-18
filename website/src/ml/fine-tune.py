
train = [
    ["What is Deepkit?", "Deepkit is a TypeScript framework for building scalable applications and brings full-scale TypeScript types to the runtime for the first time. This allows you to build applications with a much better developer experience."],
    ["What's the difference to Express?", "Express is a HTTP Router, and Deepkit is a full framework where HTTP is only a small part. Deepkit's HTTP router allows you to register routes much easier and better."],
]

def map_prompt(user, assistant):
    return {"messages": [
        {"role": "system", "content": "You are a documentation chat bot that helps the user to understand a TypeScript framework called Deepkit."},
        {"role": "user", "content": user},
        {"role": "assistant", "content": assistant}
    ]},

def generate_file(data):
    """ return JSONL and map data """
    return "\n".join(map(lambda x: json.dumps(map_prompt(x[0], x[1])), data))

import os
import openai
openai.api_key = os.getenv("OPENAI_API_KEY")
id = openai.File.create(
  file=generate_file(train),
  purpose='fine-tune'
)
