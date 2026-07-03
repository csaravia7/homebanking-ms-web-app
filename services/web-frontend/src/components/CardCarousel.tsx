import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Card } from '../types';
import './CardCarousel.css';

interface CardCarouselProps {
  cards: Card[];
  onAddCard?: () => void;
  onSelectCard?: (card: Card) => void;
}

export const CardCarousel: React.FC<CardCarouselProps> = ({
  cards,
  onAddCard,
  onSelectCard,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? cards.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === cards.length - 1 ? 0 : prev + 1));
  };

  if (cards.length === 0) {
    return (
      <div className="card-carousel-empty">
        <div className="empty-state">
          <div className="empty-icon">💳</div>
          <h3>No Cards Yet</h3>
          <p>Add a card to get started with your account</p>
          {onAddCard && (
            <button className="btn btn-primary" onClick={onAddCard}>
              <Plus size={20} />
              Add Your First Card
            </button>
          )}
        </div>
      </div>
    );
  }

  const current = cards[currentIndex];

  return (
    <div className="card-carousel">
      <div className="carousel-header">
        <h3>My Cards</h3>
        {onAddCard && (
          <button className="btn btn-secondary btn-small" onClick={onAddCard}>
            <Plus size={16} /> Add Card
          </button>
        )}
      </div>

      <div className="carousel-container">
        <button
          className="carousel-button carousel-button-prev"
          onClick={handlePrevious}
          aria-label="Previous card"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="carousel-cards">
          {cards.map((card, index) => (
            <div
              key={card.id}
              className={`carousel-card-wrapper ${
                index === currentIndex ? 'active' : ''
              }`}
              onClick={() => onSelectCard?.(card)}
            >
              <div className={`carousel-card gradient-${getCardGradient(card.cardType)}`}>
                <div className="card-chip">
                  <div className="chip-inner"></div>
                </div>

                <div className="card-content">
                  <div className="card-type">{card.cardType}</div>
                  <div className="card-holder">{card.cardholderName}</div>

                  <div className="card-number">
                    {maskCardNumber(card.cardNumber)}
                  </div>

                  <div className="card-footer-info">
                    <div>
                      <span className="label">Expires</span>
                      <span className="value">{card.expiryDate}</span>
                    </div>
                    <div className="card-logo">
                      {getCardBrand(card.cardNumber)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          className="carousel-button carousel-button-next"
          onClick={handleNext}
          aria-label="Next card"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      <div className="carousel-indicators">
        {cards.map((_, index) => (
          <button
            key={index}
            className={`indicator ${index === currentIndex ? 'active' : ''}`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Go to card ${index + 1}`}
          ></button>
        ))}
      </div>

      {current && (
        <div className="carousel-card-info">
          <div className="info-row">
            <span className="info-label">Card Status</span>
            <span className={`badge badge-${current.status.toLowerCase()}`}>
              {current.status}
            </span>
          </div>
          {current.balance !== undefined && (
            <div className="info-row">
              <span className="info-label">Available Balance</span>
              <span className="info-value">
                ${current.balance.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function maskCardNumber(cardNumber: string): string {
  const last4 = cardNumber.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

function getCardBrand(cardNumber: string): string {
  if (cardNumber.startsWith('4')) return 'VISA';
  if (cardNumber.startsWith('5')) return 'MASTERCARD';
  if (cardNumber.startsWith('3')) return 'AMEX';
  return 'CARD';
}

function getCardGradient(cardType: string): string {
  const gradients: { [key: string]: string } = {
    DEBIT: 'primary',
    CREDIT: 'secondary',
    PREPAID: 'accent',
  };
  return gradients[cardType] || 'primary';
}
