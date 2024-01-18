def start_message():
    return [
        {"role": "system", "content": "You are a documentation chat bot that helps the user to understand a TypeScript framework called Deepkit."},
    ]


def map_prompt(messages, user, assistant=None):
    messages.append({"role": "user", "content": user})
    if assistant:
        messages.append({"role": "assistant", "content": assistant})
    return messages


def read_file(path):
    """ read md file from src/pages """
    path = os.path.join(os.path.dirname(__file__), '../pages/', path)
    with open(path, 'r') as f:
        return f.read()


def prompt_get_queries():
    doc = read_file('documentation/introduction.md')
    return map_prompt(start_message(), f"""
    Given text from a documentation:
```{doc}```

Generate me 20 possible questions or queries a potential user could ask/query.
""")


#
# def generate_file(data):
#     """ return JSONL and map data """
#     return "\n".join(map(lambda x: json.dumps(map_prompt(x[0], x[1])), data))


import os
import openai

openai.api_key = os.getenv("OPENAI_API_KEY")
openai.api_key = "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"

response = openai.ChatCompletion.create(
    model="gpt-3.5-turbo-0613",
    messages=prompt_get_queries(),
    # functions=functions,
    # function_call="auto",  # auto is default, but we'll be explicit
)

print(response['choices'][0]['message']['content'])
