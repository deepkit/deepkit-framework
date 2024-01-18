from transformers import T5Tokenizer, T5ForConditionalGeneration
import torch

tokenizer = T5Tokenizer.from_pretrained('BeIR/query-gen-msmarco-t5-large-v1')
model = T5ForConditionalGeneration.from_pretrained('BeIR/query-gen-msmarco-t5-large-v1')
model.eval()


def query(para):
    input_ids = tokenizer.encode(para, return_tensors='pt')
    with torch.no_grad():
        outputs = model.generate(
            input_ids=input_ids,
            max_length=64,
            do_sample=True,
            top_p=0.95,
            num_return_sequences=3)

        print("Paragraph:")
        print(para)

        print("\nGenerated Queries:")
        for i in range(len(outputs)):
            query = tokenizer.decode(outputs[i], skip_special_tokens=True)
            print(f'{i + 1}: {query}')


query(
    "One of the most difficult problems in software development is to maintain a high development speed even after months or years, especially when the code and the team grow. There are many frameworks that promise to get you started quickly and allow you to cobble together more complex applications on your own in a very short time.")
