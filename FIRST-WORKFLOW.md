# Your first n8n workflow

Goal: click a button and generate a personalized message. Running this example requires no subscription, external service credentials, or network requests.

```text
Manual trigger → My information → My message
```

A **node** is a step. **Connections** pass data between steps. Data travels as **items** containing JSON. An **expression** calculates a value from the incoming data.

## 1. Open n8n

Double-click `Start.command` (Start), then complete owner account setup if prompted. Open a new workflow in the editor. Exact interface labels may vary by version.

## 2. Try the included example (2 minutes)

1. In the workflow's `…` menu, choose **Import from File**.
2. Select `workflows/01-hello.json` from this folder.
3. Three nodes appear. The workflow is named **My first workflow — Hello**.
4. Click **Save** if needed; some versions save automatically.
5. Click **Execute Workflow**.
6. Open the last node, **My message**, and inspect **Output / JSON**.

Expected output:

```json
{
  "message": "Hello Nicolas! My first n8n workflow works.",
  "status": "Successful"
}
```

Open **My information**, replace `Nicolas` with another first name, and run the workflow again to see the output change.

## 3. Build it yourself (5–10 minutes)

### A. Add the trigger

Create a new workflow and name it **My personal test**. Add **Manual Trigger**, which may appear as **Trigger manually** or **When clicking Execute Workflow**. This starts the workflow when you click the execution button.

### B. Add the input data

Click `+` after the trigger and search for **Edit Fields (Set)**. Rename the node **My information**.

In **Manual Mapping** mode, add two **String** fields:

| Field name | Fixed value |
| --- | --- |
| `firstName` | `Nicolas` |
| `text` | `My first n8n workflow works.` |

Keep these field names to match the expression below.

Run the node with **Execute step**, or execute the whole workflow. Its output should contain both fields.

### C. Compose the message

Add another **Edit Fields (Set)** node, rename it **My message**, and connect it to **My information**.

Add a String field named `message`. Switch its value to **Expression** mode and enter:

```javascript
{{ 'Hello ' + $json.firstName + '! ' + $json.text }}
```

`$json.firstName` reads the `firstName` field of the item received from the previous node. The `+` operator joins the text fragments. In an exported JSON file, n8n prefixes the expression with `=`; in the editor, just use Expression mode.

Add another String field named `status`, with the fixed value `Successful`. Turn off **Include Other Input Fields**, if shown, to keep only the two output fields.

### D. Test it

Save and click **Execute Workflow**. All three steps should succeed. Open **My message** and check the expected output above.

If you see `undefined`, check the spelling and capitalization of `firstName` and `text`, plus the connection between the nodes. If the literal text `{{ ... }}` appears, make sure the value is in Expression mode.

## 4. Explore further

- Change `firstName` and `text` to see how data flows through the workflow.
- Add an **If** node after **My information** to check whether `firstName` equals `Nicolas`, then connect **My message** to its true output.
- To run on a schedule, replace the manual trigger with **Schedule Trigger**, set an interval, and **publish/activate** the workflow using the control available in your version. This installation uses the `Europe/Paris` time zone. Your Mac and Docker must remain running.

The manual workflow does not need to be published or activated. Its output stays in n8n; it sends no email or other external message.

## 5. Save your work

In the `…` menu, choose **Download / Export** to obtain the workflow JSON. This describes the steps but does not replace the Docker volume backup described in the [README](README.md). Review exported data before committing it to GitHub.
