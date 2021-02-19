import React, { Component } from 'react';
import { StyleSheet, Button, Image, ScrollView, View } from 'react-native';
import { Text } from '../components/Themed';
import Swiper from 'react-native-deck-swiper';
import { getArticles } from '../services/getData';
import { ArticleInterface, defaultArticle } from '../models/Article';
import ProfileContext from '../components/ProfileContext';
import CardDeck, { SwipeDirection } from '../components/CardDeck';
import { calculateScore } from '../util/calculateScore';
import { writeReport } from '../services/writeReport';
import { articlesToReport } from '../models/Article';

type NextPair = {
  card: ArticleInterface;
  nextCard: ArticleInterface;
};

interface CardInterface {
  data: ArticleInterface;
}

interface StatusCardInterface {
  text: string;
}

function StatusCard({ text }: StatusCardInterface) {
  return <Text>{text}</Text>;
}

const emptyArticles: ArticleInterface[] = [];
const MAX_CARDS_TO_PULL = 10; // this has to be a positive integer

export default class TestScreen extends Component {
  swiper: Swiper<ArticleInterface> | null = null;

  state = {
    loading: false,
    initialDatabaseCards: [] as ArticleInterface[],
    databaseCards: [] as ArticleInterface[],
    selectedCards: [] as ArticleInterface[],
    cardsPulled: 0,
    surveyStartTimestamp: 0,
    done: false,
  };

  componentDidMount() {
    this.setState({ loading: true });

    const initialDatabaseCards = getArticles();
    const databaseCards = [...initialDatabaseCards];
    this.setState({
      initialDatabaseCards,
      databaseCards,
      cardsPulled: 0,
      loading: false,
      surveyStartTimestamp: Date.now(),
    });
  }

  handleSwipe = (direction: SwipeDirection, card: ArticleInterface) => {
    console.log(
      'handleSwipe direction: ' + direction + ' on card with id ' + card.id
    );
    const selectedCards = [...this.state.selectedCards];
    const databaseCards = [...this.state.databaseCards];
    let cardsPulled = this.state.cardsPulled;

    const index = databaseCards.indexOf(card);
    if (index > -1) {
      if (direction === SwipeDirection.RIGHT) {
        card.choice = 1;
      } else if (direction === SwipeDirection.LEFT) {
        card.choice = -1;
      }
      card.timestamp = Date.now();
      selectedCards.push(card);
      databaseCards.splice(index, 1);

      cardsPulled++;
      this.setState({ selectedCards, databaseCards, cardsPulled });
    }
  };

  tryAgain = () => {
    this.setState({
      cardsPulled: 0,
      databaseCards: [...this.state.initialDatabaseCards],
      selectedCards: [],
      surveyStartTimestamp: Date.now(),
    });
  };

  goToResults = () => {
    const profile = this.context;

    // 1. save results to db
    const { cardsPulled, selectedCards } = this.state;

    if (this.reachedLimit(cardsPulled)) {
      const username = profile.username ? profile.username : 'unknown';
      const surveyReport = {
        username,
        reportStart: this.state.surveyStartTimestamp,
        data: articlesToReport(selectedCards),
      };
      writeReport(surveyReport);
    }
    // 2. go to results page
    //TODO : find way to change to profile page
  };

  getMaximizedCard = (
    cards: ArticleInterface[],
    currentScore: number
  ): number => {
    if (cards.length === 0) return -1;

    let indexOfMax = 0;
    let maxChoice = 0;

    cards.forEach((card, index) => {
      const choice = 2 * card.quality + Math.abs(card.grade - currentScore);
      if (choice > maxChoice) {
        maxChoice = choice;
        indexOfMax = index;
      }
    });
    return indexOfMax;
  };

  selectNextCard = (
    cards: ArticleInterface[],
    currentScore: number
  ): NextPair => {
    const databaseCards = [...cards];
    let firstCard = defaultArticle;
    let secondCard = defaultArticle;
    const firstCardIndex = this.getMaximizedCard(databaseCards, currentScore);
    let secondCardIndex = -1;
    if (firstCardIndex > -1) {
      firstCard = databaseCards[firstCardIndex];
      databaseCards.splice(firstCardIndex, 1);
      secondCardIndex = this.getMaximizedCard(databaseCards, currentScore);
      if (secondCardIndex > -1) secondCard = databaseCards[secondCardIndex];
    }
    return { card: firstCard, nextCard: secondCard };
  };

  reachedLimit = (cardsPulled: number): boolean => {
    return cardsPulled >= MAX_CARDS_TO_PULL;
  };

  render() {
    const { loading, cardsPulled } = this.state;
    const profile = this.context;
    const reachedLimit = this.reachedLimit(cardsPulled);
    const currentScore = calculateScore(this.state.selectedCards);

    const nextPair = this.selectNextCard(
      this.state.databaseCards,
      currentScore
    );
    let { card, nextCard } = nextPair;
    // store score in card for the record
    card.calculatedScore = currentScore;

    if (cardsPulled === MAX_CARDS_TO_PULL - 1) nextCard = defaultArticle;

    return (
      <View style={styles.container}>
        {loading ? (
          <StatusCard text='Loading...' />
        ) : (
          <>
            <Text style={styles.hello}>
              Hello {profile.firstname} {profile.lastname}
            </Text>
            {reachedLimit ? (
              <>
                <CardDeck
                  key={defaultArticle.title}
                  card={defaultArticle}
                  nextCard={defaultArticle}
                  handleSwipe={() => console.log('swipe disabled')}
                  displayButtons={false}
                />
                <Button
                  title='Start over'
                  onPress={() => {
                    this.tryAgain();
                  }}
                />
              </>
            ) : (
              <CardDeck
                key={card.title}
                card={card}
                nextCard={nextCard}
                handleSwipe={this.handleSwipe}
                legend={`Card ${cardsPulled + 1}/${MAX_CARDS_TO_PULL}`}
                displayButtons={true}
              />
            )}
          </>
        )}
      </View>
    );
  }
}
TestScreen.contextType = ProfileContext;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    // alignItems: 'center',
    //justifyContent: 'center',
  },
  hello: {
    fontSize: 20,
    alignSelf: 'center',
  },
  content: {
    flex: 2,
    alignSelf: 'center',
    position: 'absolute',
    bottom: -4,
    backgroundColor: 'white',
    margin: 5,
    paddingHorizontal: 20,
    borderTopRightRadius: 12,
    borderTopLeftRadius: 12,
  },
  swiper: {
    height: '90%',
  },
  buttons: {
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
});
