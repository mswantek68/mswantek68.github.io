---
title: Enrich your SharePoint list data using Microsoft Flow and APIs
date: 2019-11-21 08:00:00 -0700
categories: [enrichment]
---

![alt text](/assets/images/posts/enrich-your-sharepoint-list-data-using-microsoft-flow-and-apis/enrich.png)

## Why enrich data?


Adding enrichment to existing SharePoint list data surfaces additional fields that can be searched and refined, can be used for business intelligence, or simply use for an upcoming report. For example, company names and postal addresses within a SharePoint list are common for an organization. Imagine typing in basic information for a company or client, but besides that basic information, items like company economic data, LinkedIn profile, a Bing Map and demographic information of the area appear in the same list as the address. Adding that information by hand is inefficient. Purchasing enrichment lists is expensive, and most times the data you receive is suspect. Think about adding a company name and address, and having a Flow add multiple fields to that list without the investigation and the typing or effort that it would take. This is only one example of data enrichment, but let your imagination run wild! Data enrichment is no longer reserved for "Big Data" solutions and I will show you how to add beneficial additional metadata to your existing list in SharePoint, along with other tips and tricks that I have found along the way. 





## What is the process for enriching data? 

For the sake of clarity, I will be covering the use of Microsoft tools (mostly SharePoint) in my blog examples. The overall process would be similar across other systems, I just won't be covering them here. The pre-requisites required prior to adding data enrichment on a SharePoint list are:


- **Source data** - This is the data that exists in your system. For this example we will assume you have a list of addresses of important places in a SharePoint list.
- **Enrichment sources** - There are many free API's that are available on the internet from the US Government, for both national and local levels. Most free sources do require you to register to get an API key. This allows for a larger amount of use of the API's (more calls per day, no limit on amount of records being returned, etc). For Census data, see [https://www.census.gov/data/developers/data-sets.html](https://web.archive.org/web/20220204034157/https://www.census.gov/data/developers/data-sets.html) for a list of available data sources to use. Doing a few Bing searches will point you to API's available to use. I will supply a list of sources with url's that I have used in an upcoming blog post. 
-  [Postman](https://web.archive.org/web/20220204034157/https://learning.getpostman.com/docs/postman/launching_postman/installation_and_updates/) - this is an invaluable tool to use when doing any kind of API work. Postman allows you to create 'Get' and 'Post' calls to the chosen API, and view the JSON payload prior to setting up an HTTP connector in Flow or Logic Apps.
- A **willingness** to learn, grow and have fun while doing so!

## The general concept


For this demonstration, I will be using the zip code supplied in a SharePoint list, sending that zip code to a REST service using Flow, and returning the latitude and longitude for that zip code.

## The SharePoint list

For this enrichment walk-through, begin by creating a custom SharePoint list with separate columns for address, city, state and zip code as a text column. I typically use Site Columns as it reduces the need to create a managed property later.  
You will also create a column for each enrichment piece that you will be writing back to the SharePoint list. Add a column for longitude and a column for latitude as a number column.

![](/assets/images/posts/enrich-your-sharepoint-list-data-using-microsoft-flow-and-apis/image.png)

## Test the API using Postman


We will  add an "HTTP" connector to the flow to call the Census.gov API. There are many available fields within the Census API, I will not go into them in this blog but instead I suggest that you navigate to the US Census Developer page [here](https://web.archive.org/web/20220204034157/https://www.census.gov/data/developers/data-sets.html) and view the vast amount of resources they have provided. I will be using the Census [geocoding](https://web.archive.org/web/20220204034157/https://www.census.gov/data/developers/data-sets/Geocoding-services.html) services to send it an address, and return a latitude and longitude. It is a good idea to utilize Postman for your API call development, prior to writing the "HTTP" connector piece into your flow. 



First, find the base URL and the required parameters needed for this API to return a lat/long from an address from the online documentation.  
For this example, I will be using
***https://geocoding.geo.census.gov/geocoder/geographies/address?*** uri to send the service an address, and return the latitude and longitude (Most additional calls within the Census API require the latitude and longitude value). 
The required parameters for this uri are either a **one line address,** or **an address, city, state and zip code.** 
Paste the uri into Postman (or if you are daring), straight into the "HTTP" connector. 





Supply the address parameters along with:

-  the benchmark=**Public_AR_Census2010**
-  the vintage=**Census2010_Census2010**
-  the layers=**all**
-  the format=**json **
- hit the Send button. 


![](/assets/images/posts/enrich-your-sharepoint-list-data-using-microsoft-flow-and-apis/image-2.png)



The response will return with a long amount of JSON formatted text. You will see that there is an "x" and a "y" parameter returned. This is also a great time to try different parameters to see different results, or move on to building the flow. The purpose of using Postman is to verify that the returned results are what we want.



![](/assets/images/posts/enrich-your-sharepoint-list-data-using-microsoft-flow-and-apis/image-3.png)


#### It is important to point out that using Postman first will go a long way in debugging an enrichment flow. You have a response with real data and know that works!


## The Flow



Once you have your list columns in SharePoint, and an API call that returns the values we need, the next step it to open up Microsoft Flow in your browser and create a blank flow. Next, connect the trigger "When an item is created" to the SharePoint list you created. Then, add the "Get item" connector. 



![](/assets/images/posts/enrich-your-sharepoint-list-data-using-microsoft-flow-and-apis/image-1.png)



## Add the "HTTP" connector and dynamic values





Add an "HTTP" connector to the Flow and paste in the uri string from Postman. We will remove the static text and replace it with dynamic values that are sent by SharePoint each time a new address is added. Highlight and replace the static text using the dynamic content pane. (If all of your values do not appear, select the "See More" in the dynamic content picker). Leave the other parameters within the uri string.



![](/assets/images/posts/enrich-your-sharepoint-list-data-using-microsoft-flow-and-apis/image-7.png)



## Parsing the API results





When the API runs and returns its results, it is a good idea to parse the JSON file for Flow to be able to select the individual values easier. Add a "Parse JSON" connector to the Flow beneath the "HTTP" connector. You will select the body of the API call and you will need to provide a JSON schema for the parsing to be done correctly. You have two choices; either use the returned JSON body within Postman, or, add an address to your SharePoint list, and then review the Flow run history and use the value from that run.  
Either way, you will need to select the entire output of the JSON call and paste it within the Parse JSON step. 



![](/assets/images/posts/enrich-your-sharepoint-list-data-using-microsoft-flow-and-apis/image-8.png)Within a successful Flow run, you can see the results of each Flow connector step. Select the "body" that was returned from this flow run to add to the Parse JSON step.


![](/assets/images/posts/enrich-your-sharepoint-list-data-using-microsoft-flow-and-apis/image-10.png)

![](/assets/images/posts/enrich-your-sharepoint-list-data-using-microsoft-flow-and-apis/image-9.png)

![](/assets/images/posts/enrich-your-sharepoint-list-data-using-microsoft-flow-and-apis/image-11.png)Proper JSON Schema added to "Parse JSON"



## Writing the latitude and longitude value back to SharePoint





Now that we have made a call to the Census API and we have supplied it the address, we will need to extract the value from the JSON response body that we have parsed. and write those values back to SharePoint. This will be the enrichment of the data. These values are stored in the JSON file as "x" and "y" (X=longitude and Y=latitude).





Add the "Update Item" connector to the Flow, and select the Site address, the  list name and the ID (same list and item as we started with). You will then add the values from the "Parse JSON" connector to the latitude and longitude fields.



![](/assets/images/posts/enrich-your-sharepoint-list-data-using-microsoft-flow-and-apis/image-13.png)



You will notice that Flow added an "Apply to each" connector. This is common when using JSON values within Flow. I wanted to keep this a basic enrichment post, so I left the steps as is. In practice, we are sending and returning a single name value pair to the API, and expect a single name value pair returned. In future blogs, I will show how to use the expression editor to add the value directly to the list field without the "Apply to each" connector. 





## What have we done?





In this demonstration, we have started with a SharePoint list, added columns for Address, City, State and Zip code. We have then added a latitude and longitude column for enrichment. We called an API from the US Census, sent it our address that we entered into the SharePoint list, and returned a latitude and longitude for that address. Pretty cool huh? You can now find current weather, the population, when the International Space Station will cross overhead, just about any positional based information can be added to your list. This is called data enrichment, and it is a powerful addition to your SharePoint lists!



![](/assets/images/posts/enrich-your-sharepoint-list-data-using-microsoft-flow-and-apis/image-14.png)




