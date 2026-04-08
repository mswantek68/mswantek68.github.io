---
title: Add enrichment to your data with Power Query - Instead of an HTTP connector
date: 2019-11-20 08:00:00 -0700
categories: [infrastructure]
---



As I lead into my presentation and demos about *Adding enrichment to your data in SharePoint and Azure using Microsoft Flow and Logic Apps* this Saturday at SPS Pittsburgh, I realize that the topic of suggesting using premium connectors in Flow to enrich your data may not work for everyone because of pricing. Not all of us can afford to pay for additional licensing.





No worries! I have documented a way to connect to various free, third-party data sources using Power Query, and adding that data to your data set, prior to uploading to SharePoint! 





## Find the right data sources





I will be bringing in a data set of all building permits requested and issued in the Washington DC area. I theorize that building permits will be issued and approved more often to those that live in an area with a higher median income. The key to this solution, is that it has to be a targeted API uri that will return the values you need. There are many open data API's on the internet. One that I visit regularly is [https://dev.socrata.com](https://web.archive.org/web/20220406080916/https://dev.socrata.com/) which compiles open data sources from states and cities in the USA. [https://opendata.howardcountymd.gov/resource/kvz2-j5cj.json](https://web.archive.org/web/20220406080916/https://opendata.howardcountymd.gov/resource/kvz2-j5cj.json) is the data source I selected to show the permits.











## Create a connection in Power Query





Grab Excel, or Power BI, fire up Power Query, and add a new data source.





### 1.0 Get Data





Select "Get Data" and choose "web"



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image.png)



### 1.1 Connect with Anonymous credentials



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image-1.png)



Since this is a public API, there are no credentials needed.











### 1.2 Import the table



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image-2.png)



When Power Query brings in a web source, it creates a list of records which must be moved into a table. You are prompted for a delimiter, but leave the defaults as is!





### 1.3 Expand the table in Power Query



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image-3.png)



You will see an icon in the right corner of the new column. By clicking this, it will expand and then import even more new columns





### 1.4 Select the columns from the enrichment API that you want



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image-4.png)



### 1.5 Rename the new dynamic columns in the new data table





This is not necessary, but is a sound practice.



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image-6.png)



### 2.0 Bring in the second data set





We are next going to add a static data set from a csv file. I am getting a list of US Zip codes with median home value and median income compiled by the University of Michigan. Download the csv file to your computer. You will need it in the next step.



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image-7.png)



### 2.1 Add the csv file to Power Query



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image-9.png)



This step adds the csv data to the Power Query editor as a table.





### 2.2 Select the data required





Within the data set I downloaded, there were three tabs of data. I only want the median household income, so I just selected that. 



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image-10.png)



### 2.3 Merge the queries





This step is what will connect the key fields in both the table and the API that you have brought in. After this step, you will produce a new table that has joined all the information from the query (Building permits by zip code) to the Median Household income by zip code table. 



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image-12.png)



### 2.4 Expand the merged table column





When creating the merged table, understand that the column may need to be expanded again as in the previous steps. Think of expanding the columns within the Power Query to be like parsing of the JSON file. 





Again, double click on the icon in the right corner of the row table. (in this case "Median")



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image-13.png)



### 2.5 Expand and select columns to display





Select the columns that you would like to expand into this merged data set. 



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image-15.png)



### 2.6 Bask in the knowledge that you enriched your data with an API and didn't need a premium connector!!



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image-16.png)



### 3.0  Use the newly enriched data





Here I wanted to understand if more building permits were issued to those with a higher income.



![](/assets/images/posts/add-enrichment-to-your-data-with-power-query-instead-of-an-http-connector/image-17.png)



Turns out, it is the people in the middle of the income range that pull the most building permits. Who would have known! Well, YOU now know that you can add enrichment to data sources within Microsoft without using Flow HTTP! 





Happy Enriching! 






