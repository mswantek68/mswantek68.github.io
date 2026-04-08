---
title: Using PIPL API Service and Microsoft Logic Apps to enrich your marketing list
date: 2019-07-11 08:00:00 -0700
categories: [infrastructure]
---
![alt text](/assets/images/posts/use-pipl-api-service-and-microsoft-logic-apps-to-enrich-marketing-list/image-1.jpg)
PIPL ("PEOPLE") is a service used to search for a person and return relevant information about them. This service is a fee per transaction service that will "enrich" the information of a person that you send it. There are several options to use the service, upload a spreadsheet of contacts and select the enrichment you would like returned, or an API that returns a JSON payload. The API has three levels of access ranging from $0.10 to $0.40 per returned record.
![alt text](/assets/images/posts/use-pipl-api-service-and-microsoft-logic-apps-to-enrich-marketing-list/image-2.png)
The PIPL API is what was used for a project to enrich a marketing list. I selected the "Business" API service. The fields returned are shown in the graphic below.

PIPL API is SSL compliant and can also accept MD5 hashed email to preserve anonymity when transmitting.

Per PIPL, the **minimal requirement** to run a search is to have at least one full name, email, phone, username, user_id, URL or a single valid US address (down to a house number).

## 1.0 ORGANIZE DATA IN THE DATABASE TABLE

My marketing list contained first name, last name, address, city, state, zip code and a birth-date. This data will be fed into the PIPL API using an HTTP call in Logic apps.

My database table of contacts was copied, and an additional column was added for adding a status of the record enrichment. I created a table from the master marketing list that only contained records that needed a cell phone and email address.

## 2.0 CREATE THE QUERIES

Using Postman and the sample queries within the PIPL API documentation, I created and tested the request and JSON response from the PIPL API. There are many search configuration parameters available for use in this API to minimize incorrect matches, and to also check if the information we needed was in the PIPL database. These "Atomic" queries will only retrieve the information if it exists, therefore reducing the total amount of cost involved using this API. We specifically were interested in the user's personal email and the users mobile phone number, but the data returned has many more fields available.
From the PIPL API documentation, this is a [sample response](https://docs.pipl.com/reference/#section-example-response-) from a person search:
![Example of PIPL response](/assets/images/posts/use-pipl-api-service-and-microsoft-logic-apps-to-enrich-marketing-list/image-3.png)

PIPL made the search easy by utilizing [Match Criteria](https://docs.pipl.com/reference/#match-criteria) as explained in their documentation. For example, phone.mobile or address.personal were used to define my query. The criteria will be met if the response contains at least one person (perfectly matching or a possible person) which includes a source of the requested category. I also only wanted a confirmed match (we knew who we were looking for), so the "Minimum Match" value was set to 1.0.


Here is an example of the "Free" development search for PIPL in Postman. This query will return a JSON body that differs slightly from that of a real person however, making the parsing of the JSON within the Logic App somewhat problematic.
![alt text](/assets/images/posts/use-pipl-api-service-and-microsoft-logic-apps-to-enrich-marketing-list/image-4.png)
The API request that I used within the Logic App looked like this:

```
http://api.pipl.com/search/?person=@{variables('SetJSON')}&key=qz7xc4xgoucccxxxxxxxxxxxxxxxx&show_sources=matching&minimum_match=1&match_requirements=(phone.mobile|email.personal )
```

Where @{variables('SetJSON')} is the Logic App variable created to hold the request body (see step 3.5 below) and key is the unique API key from PIPL that you receive when you have created an account.

Using this "atomic query" would assure that the data I requested was an exact match to the data sent. If there was a match found to a person, I only want returned (the match requirements) to be mobile phone or personal email. If neither of those fields exist in the PIPL database, I will not be charged for that request.

Because of the parsing issues that I ran into in the Logic App (some records returned more data, some less making it next to impossible to use a JSON schema in the Logic App for parsing), and the fact that I was not sending this enrichment to the Search Index using CEWS, I decided to write the entire JSON response from PIPL to a SQL column. The benefit is that a call is made to the PIPL service once, and only $0.40 charge per member is made. The JSON body can then be parsed to get additional member data after the fact.
See this [Microsoft Document](https://web.archive.org/web/20220204034153/https://docs.microsoft.com/en-us/sql/relational-databases/json/json-data-sql-server?view=sql-server-2017) for more information on structuring your queries.
## 3.0 Create the Logic App

### 3.1 HTTP REQUEST CONNECTOR
To create the Logic App, I start with an HTTP request and connector. Adding a blank HTTP Request connector allows you to use Postman to trigger the Logic App for testing, or to connect it another Logic App as a webhook.

### 3.2 SQL CONNECTOR
The next step involves connecting to the Azure SQL database table where the data is stored. The table that this Logic App points to has been created to only contain members that do not currently have an email address, or a phone listed. An additional column was added to contain a "flag" to be set when the enrichment occurred. I have added a SQL Query Connector to allow precise selection of the data I want to send to the PIPL service.
![SQL Query connector in Logic Apps](/assets/images/posts/use-pipl-api-service-and-microsoft-logic-apps-to-enrich-marketing-list/image-5.png)
### 3.3 SETTING UP VARIABLES
I set a variable of type string to house the JSON body when it is retrieved from the PIPL service.
![alt text](/assets/images/posts/use-pipl-api-service-and-microsoft-logic-apps-to-enrich-marketing-list/image-6.png)
### 3.4 FOR EACH AND CONDITION STEP
When the Logic App calls the SQL Query, it loads the data and then each row is sent to the PIPL API. Because of throttling concerns with the service and to be sure that the call sent was the data returned, I decided to set the concurrency setting to "ON" and the degree of parallelism to 1. This would assure that the data sent to the service was returned and recorded before the next request to the PIPL API is sent. Performance took a backseat to a wayward spend of the clients' money.
![SQL Query concurrency set to “ON” for connector](/assets/images/posts/use-pipl-api-service-and-microsoft-logic-apps-to-enrich-marketing-list/image-7.png)
Inside of the "For-Each" is a condition which checks to see if the row has previously been enriched, and if so, bypasses the PIPL enrichment call. Each record that is enriched will then set this flag so the record will not be sent multiple times.
![For-each loop](/assets/images/posts/use-pipl-api-service-and-microsoft-logic-apps-to-enrich-marketing-list/image-8.png)
### 3.5 CREATE THE JSON BODY TO SEND TO API
If the current record has not been previously enriched by the service, the Logic App will then create the JSON body to send to the API using fields from the current line of data. First name, Last name, mailing address and a start and end date for DOB date_range is created as JSON. The "Start" and "End" are the same value to define a birthdate, and not a range of years. This will ensure that a definitive match has occurred for this record. PIPL does allow an age range (ex. 56-58 would search for people with that name in that range but the service does not return an exact birthdate.)
![Create JSON body to send to API](/assets/images/posts/use-pipl-api-service-and-microsoft-logic-apps-to-enrich-marketing-list/image-9.png)
### 3.6 SEND THE JSON BODY TO THE API
The API call to PIPL is made with a GET call. It includes the API address, the "person=" variable from the previous step, the key from PIPL, "show_sources_matching" which will only return a person with that specific name, age and address (previous or current), "minimum_match=1" which will bring back only one match, and "match_requirements=(email.personal | phone.mobile)" which only retrieves a person record if there is a cell phone or a personal email in the database. I specifically set the uri with these filters to only return relevant results that I wanted.
![HTTP call to PIPL API](/assets/images/posts/use-pipl-api-service-and-microsoft-logic-apps-to-enrich-marketing-list/image-10.png)


### 3.7 SET THE ENRICHED FLAG TO TRUE IN THE DATABASE
Setting the flag after the record has been passed and responded to will eliminate any duplicate attempts to enrich the record, causing additional spend for the enrichment.
![Set a flag in the record to show it has been processed](/assets/images/posts/use-pipl-api-service-and-microsoft-logic-apps-to-enrich-marketing-list/image-11.png)
### 3.8 WRITE THE JSON RESPONSE BODY TO THE SQL TABLE
A separate table was created in the database to write the JSON response and the MD5Hash (unique record identifier). The JSON response column is set to nvarchar(max) to allow for the content to be housed in the SQL table.
![Write the JSON back to SQL table](/assets/images/posts/use-pipl-api-service-and-microsoft-logic-apps-to-enrich-marketing-list/image-12.png)
## 4.0 THE RESULTS

### 4.1 Working with the JSON data in SQL
Here is a sample of the SQL query that will pull the warning out of the JSON body:

```
SELECT MD5Hash, JSON_VALUE(responseJSON, '$.warnings[0]') AS warnings, JSON_VALUE(responseJSON, '$.query.addresses[0].display') AS correctedaddress
  FROM [dbo].[tbl_Marketing_PIPL_enrichment]
  WHERE JSON_VALUE(responseJSON, '$.warnings[0]') IS NOT NULL
```

### 4.2 SOURCES OF KNOWLEDGE FOR SQL IN JSON
The following links are Microsoft Documentation about JSON in SQL. They are useful as are the videos within the pages.

- JSON data in SQL Server - https://docs.microsoft.com/en-us/sql/relational-databases/json/json-data-sql-server?view=sql-server-2017
- JSON Functions (Transact-SQL) - https://docs.microsoft.com/en-us/sql/t-sql/functions/json-functions-transact-sql?view=sql-server-2017

The results using the PIPL API service were better than expected. Parsing the data at run time was the most challenging, which is what drove me to store the values within SQL. Many of the records have multiple email addresses, and phone numbers. PIPL does show the most recent ones first in the array and includes dates of when their last know use was. These are helpful fields when identifying the best record to select.

Some other notable results that PIPL will identify are: known associates, education levels, social media profile handles, VIN numbers and registration information, and PIPL will even correct addresses that you entered. For example, "City 'Detroit' was changed to Redford based on the street and ZIP code" is an actual response from the service. You could easily check if PIPL returned a "warning" and if so, use the corrected mailing address to replace the incorrect one in your contact list.

## 5.0 The Wrap-Up

The use of any service to enrich your customer data is a risk/reward proposition. Not knowing if the email you find to enrich your marketing information will bounce, or if the contact information received is still relevant to that customer is always a risk. The data returned by the PIPL service has safe guards in place to validate the last used time of contact information, so the risk using their service is fairly low. The choice to utilize PIPL to enrich your customer marketing lists is both wise and economical.

I will certainly suggest this service to others to try and will be certain to utilize the PIPL services on many more projects.

Happy Enriching everyone.


