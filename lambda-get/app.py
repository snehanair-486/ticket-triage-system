import json
import os
from decimal import Decimal

import boto3

TABLE_NAME = os.environ.get("TABLE_NAME", "Tickets")
table = boto3.resource("dynamodb").Table(TABLE_NAME)


def _default(o):
    if isinstance(o, Decimal):
        return int(o) if o % 1 == 0 else float(o)
    raise TypeError


def respond(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, default=_default),
    }


def lambda_handler(event, context):
    # Same function serves GET /tickets and GET /tickets/{ticketId}
    params = event.get("pathParameters") or {}
    ticket_id = params.get("ticketId")

    try:
        if ticket_id:
            item = table.get_item(Key={"ticketId": ticket_id}).get("Item")
            if not item:
                return respond(404, {"error": "Ticket not found."})
            return respond(200, item)

        items = []
        kwargs = {}
        while True:
            page = table.scan(**kwargs)
            items.extend(page.get("Items", []))
            last = page.get("LastEvaluatedKey")
            if not last:
                break
            kwargs["ExclusiveStartKey"] = last

        items.sort(key=lambda i: i.get("createdAt", ""), reverse=True)
        return respond(200, {"tickets": items})
    except Exception as e:
        print("getTickets error:", repr(e))
        return respond(500, {"error": "Could not load tickets."})