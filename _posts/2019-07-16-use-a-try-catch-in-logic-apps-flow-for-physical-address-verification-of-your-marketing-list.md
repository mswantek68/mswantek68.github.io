---
title: Use a Try, Catch in Logic Apps / Flow
date: 2019-07-16 08:00:00 -0700
categories: [logic-apps,automation]
---
![Screen shot of bear trap](/assets/images/posts/use-a-try-catch-in-logic-apps-flow/image-1.jpg)
I am creating a Logic App that utilizes a REST API from UPS (by way of the USPS) to verify and correct physical mailing addresses in the USA. I have a SQL Table that houses name, address_1, address_2, city, state and zip code. There are issues with my list of physical addresses, mostly that the address_1 and address_2 lines are combined into the address_1 field, or there are misspellings in street names, etc. On top of that, depending on the address, the USPS API will generate response JSON that is either a string, or an array, or an array of arrays. Because of this, several steps are required in the Logic App to decide which parsing strategy to utilize. This is where the error handling, or "Try-Catch" comes in.

I will first show the API connection, and then walk through the entire Logic App to explain. After some searching for a reliable, easy API for address verification, I decided on the USPS. If the US Postal Service is delivering mail to these addresses, they must know they are valid, right? Turns out though, that the USPS API returns XML. I wanted JSON response to be returned, so I kept looking. I then found that the UPS Address Validation API uses the USPS, but returns the results in JSON. Here is the UPS web site for the API: https://www.ups.com/us/en/services/technology-integration/address-validation-street-level.page

## 1.0 The API

After creating a user account for the API (FREE), access the API resources and begin. I like to use Postman to try out my APIs prior to coding them in Logic Apps / Flow. Here you can see that the Address Verification is made using a POST call, and body to carry the request. It requires your user name, and your access license, which you will receive when you request an account.
![Postman](/assets/images/posts/use-a-try-catch-in-logic-apps-flow/image-2.png)
There are several fields that are required prior to sending the request:
- Address line - the house or building address (address line 1 and address line 2 go here)
- Political Division 2 - the city of the address
- Political Division 1 - the state of the address
- Postcode Primary Low - the zip code of the address

Once these fields are satisfied, the request can be sent, and you will receive a response from the API. Notice that both "candidate" and "address line" are both returned as arrays. However, some addresses will return only a string result. This is where the "Try-Catch" comes in handy!
```json
{
"XAVResponse": {
"Response": {
"ResponseStatus": {
"Code": "1",
"Description": "Success"
},
"TransactionReference": {
"CustomerContext": "Your Customer Context"
}
},
"AmbiguousAddressIndicator": "",
"Candidate": [
{
"AddressKeyFormat": {
"AddressLine": [
"6321 MIDDLE RD",
"APT 17"
],
"PoliticalDivision2": "ROMULUS",
"PoliticalDivision1": "MI",
"PostcodePrimaryLow": "48174",
"PostcodeExtendedLow": "4211",
"Region": "ROMULUS MI 48174-4211",
"CountryCode": "US"
}
},
{
"AddressKeyFormat": {
"AddressLine": "xxxx MIDDLEBELT RD",
"PoliticalDivision2": "ROMULUS",
"PoliticalDivision1": "MI",
"PostcodePrimaryLow": "48174",
"PostcodeExtendedLow": "4211",
"Region": "ROMULUS MI 48174-4211",
"CountryCode": "US"
}
},
{
"AddressKeyFormat": {
"AddressLine": "6321 MIDDLEBELT RD",
"PoliticalDivision2": "ROMULUS",
"PoliticalDivision1": "MI",
"PostcodePrimaryLow": "48174",
"PostcodeExtendedLow": "4209",
"Region": "ROMULUS MI 48174-4209",
"CountryCode": "US"
}
}
]
}
}
```

Using some of the data in my contact table, I chose different addresses and arrived at 4 distinct types of format that the API returns. From there, I built my Logic App / Flow.

## 2.0 The Logic App / Flow

This is the entire Flow.
![alt text](/assets/images/posts/use-a-try-catch-in-logic-apps-flow/image-3.png)
The "Scope" connector is a wonderful tool to containerize steps within a Logic App / Flow. The entire connector will fail or run, and by defining the "Configure Run After" settings for each Scope set, you can define what will happen if one step fails.
![alt text](/assets/images/posts/use-a-try-catch-in-logic-apps-flow/image-4.png)
## 2.1 Creating the Logic App / Flow
The Logic App / Flow begins (for this demo) with a trigger connector to input an address to test, next, I set up variables for each of the address sections, and creating a combined address field of address 1 and address 2 in the event there is an apartment, etc. This concatenated field has a comma separating the two values, per USPS regulations.

Address_2 is set up as optional.
![alt text](/assets/images/posts/use-a-try-catch-in-logic-apps-flow/image-5.png)
![alt text](/assets/images/posts/use-a-try-catch-in-logic-apps-flow/image-6.png)
## 2.2 HTTP call to the API

Insert an HTTP connector into the Flow and configure it per the UPS API document. Include the defined headers and fabricate the body as below, inserting your dynamic values into the body as well.
![alt text](/assets/images/posts/use-a-try-catch-in-logic-apps-flow/image-7.png)

## 2.3 Insert a Scope connector and add logic within it

The scope connector is listed under the "Control" section. Scope connectors allow a series of connectors to be encapsulated within it, and inherit the last terminal status (Succeed, Fail, Cancelled, Skip) of the actions inside of it. This way, if any portion within the scope connector fails, the entire connector will fail. By combining this powerful feature with the "Configure run after" setting allows you to perform different actions and let the Logic App / Flow make the decision at run time as to which to perform.
![alt text](/assets/images/posts/use-a-try-catch-in-logic-apps-flow/image-8.png)
In the above example, this particular Scope control will set the address_1 and address_2 variable from the response of the UPS API call. It will take the first instance of the array ["Candidate"]?[0] and the first instance of the array of ["AddressLine"]?[0] for the Address1 variable, and ["AddressLine"]?[1] for the Address2 variable.

As you may remember from earlier, some addresses sent to the service contained just strings for the address, and some are multiple responses (ambiguous addresses) that are arrays of strings, or arrays of arrays.
```json
"Candidate": [
{
"AddressKeyFormat": {
"AddressLine": [
"6311 MIDDLEBELT RD",
"APT 7"
],
"PoliticalDivision2": "ROMULUS",
"PoliticalDivision1": "MI",
"PostcodePrimaryLow": "48174",
"PostcodeExtendedLow": "4211",
"Region": "ROMULUS MI 48174-4211",
"CountryCode": "US"
}
},
```
## 2.4 "Configure run after"

This is the setting that makes everything run as expected. After adding the additional variations of JSON responses from different address combinations (no address line 2, apartment number or suite in the same line of address 1, etc) configure each of the Scope connectors to run after the preceding Scope has failed. This will allow the Logic App / Flow to continue down the steps and try the next Scope control, until it either succeeds or fails.
![alt text](/assets/images/posts/use-a-try-catch-in-logic-apps-flow/image-9.png)
You can see the difference in the connection arrows when a "Configure run after" is active.

## 2.5 Test and implement

Once the Logic App / Flow has been saved, and all the Scope connectors are configured to run after failure, it is time to test the Logic App / Flow with addresses. Once you are satisfied that each of the cases has been tested, it is time to wire it up to your contact list, and either write the corrected addresses back to your data source, or create additional columns to add the modified data to it. Correcting physical addresses this way is great practice to see how "Try-Catch" in Logic Apps / Flow can be used.

Good luck.


