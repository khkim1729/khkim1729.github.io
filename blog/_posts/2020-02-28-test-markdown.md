---
layout: post
title: Order-Agnostic Cross Entropy for Non-Autoregressive Machine Translation 리뷰
subtitle: Each post also has a subtitle
gh-repo: seokho-son/seokho-son.github.io
gh-badge: [star, fork, follow]
tags: [test, markdown]
mathjax: true
comments: true

---

서울대학교 시스템프로그래밍 특강에서 세미나로 듣고 있는 논문들을 리뷰하려고 한다. 



## Non-Autoregressive Machine Translation

**Non-Autoregressive Machine Translation (NAT)** 은 기존의 NLP의 Auto-regressive한 모델을 탈피한다. 

**Autoregressive Neural Machine Translation**은 conditional probability로 $X = (x_1, \cdots, x_T')$ 가 주어졌을 때 $Y = (y_1, \cdots, y_T)$의 확률을 추정한다. 

$$p(Y|X) = p(y_t | y_{0:t-1}, X)$$


훈련 과정 중에는 병렬적으로 가능하지만, 실제로 추론할 때는 그렇지 않다. 하지만 인간의 언어 생성 방식과 비슷하다고 볼 수 있다. 

**NAT**는 길이 $T$를 정해주고 다음과 같은 Cross Entropy를 이용한다. Separated conditional distribution으로 나눠 질 수 있다고 가정한다. (즉, $y_i$끼리의 분리를 의미한다) 
$$\mathcal{L}_{XE} = - \log P(Y|X) = -\sum_{y_n} \log P(y_n|X)$$



This is a demo post to show you how to write blog posts with markdown.  I strongly encourage you to [take 5 minutes to learn how to write in markdown](https://markdowntutorial.com/) - it'll teach you how to transform regular text into bold/italics/headings/tables/etc.

**Here is some bold text**

## Here is a secondary heading

Here's a useless table:

| Number | Next number | Previous number |
| :------ |:--- | :--- |
| Five | Six | Four |
| Ten | Eleven | Nine |
| Seven | Eight | Six |
| Two | Three | One |


How about a yummy crepe?

![Crepe](https://s3-media3.fl.yelpcdn.com/bphoto/cQ1Yoa75m2yUFFbY2xwuqw/348s.jpg)

It can also be centered!

![Crepe](https://s3-media3.fl.yelpcdn.com/bphoto/cQ1Yoa75m2yUFFbY2xwuqw/348s.jpg){: .mx-auto.d-block :}

Here's a code chunk:

~~~
var foo = function(x) {
  return(x + 5);
}
foo(3)
~~~

And here is the same code with syntax highlighting:

```javascript
var foo = function(x) {
  return(x + 5);
}
foo(3)
```

And here is the same code yet again but with line numbers:

{% highlight javascript linenos %}
var foo = function(x) {
  return(x + 5);
}
foo(3)
{% endhighlight %}

## Boxes
You can add notification, warning and error boxes like this:

### Notification

{: .box-note}
**Note:** This is a notification box.

### Warning

{: .box-warning}
**Warning:** This is a warning box.

### Error

{: .box-error}
**Error:** This is an error box.
